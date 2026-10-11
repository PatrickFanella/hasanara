#!/usr/bin/env python3
"""Regression tests for CI selection and the required validation result."""
import contextlib
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from ci_plan import changed_paths, plan
from ci_gate import failures


class PlanTests(unittest.TestCase):
    def test_docs_skip_web_work(self):
        self.assertEqual(plan(["README.md", "docs/operations.md"], "pull_request", "refs/pull/1/head"),
                         {"frontend": False, "image": False, "publish": False})

    def test_frontend_pr_checks_frontend_and_container_without_publishing(self):
        self.assertEqual(plan(["frontend/src/App.tsx"], "pull_request", "refs/pull/1/head"),
                         {"frontend": True, "image": True, "publish": False})

    def test_main_frontend_builds_only_in_gated_publisher(self):
        self.assertEqual(plan(["frontend/package-lock.json"], "push", "refs/heads/main"),
                         {"frontend": True, "image": False, "publish": True})

    def test_core_pointer_rechecks_api_without_building_web_image(self):
        self.assertEqual(plan(["core"], "pull_request", "refs/pull/1/head"),
                         {"frontend": True, "image": False, "publish": False})

    def test_branding_smoke_runs_on_main_without_republishing(self):
        self.assertEqual(plan(["branding/brand.json"], "push", "refs/heads/main"),
                         {"frontend": False, "image": True, "publish": False})

    def test_docker_context_requires_image_check(self):
        self.assertTrue(plan([".dockerignore"], "pull_request", "refs/pull/1/head")["image"])

    def test_ci_changes_exercise_checks(self):
        for path in [".gitea/workflows/validate.yaml", "scripts/ci_gate.py", "scripts/ci.test.py"]:
            with self.subTest(path=path):
                result = plan([path], "pull_request", "refs/pull/1/head")
                self.assertTrue(result["frontend"])
                self.assertTrue(result["image"])

    def test_manual_main_release_checks_frontend_and_publishes(self):
        self.assertEqual(plan([], "workflow_dispatch", "refs/heads/main"),
                         {"frontend": True, "image": False, "publish": True})

    def test_manual_feature_branch_never_publishes(self):
        self.assertEqual(plan([], "workflow_dispatch", "refs/heads/feature"),
                         {"frontend": True, "image": True, "publish": False})

    def test_missing_diff_is_conservative(self):
        result = plan(None, "pull_request", "refs/pull/1/head")
        self.assertTrue(result["frontend"])
        self.assertTrue(result["image"])


class GateTests(unittest.TestCase):
    def test_intentional_skips_pass(self):
        self.assertEqual(failures("success", "skipped", "skipped", False, False), [])

    def test_all_required_success_passes(self):
        self.assertEqual(failures("success", "success", "success", True, True), [])

    def test_applicable_failed_skipped_cancelled_or_missing_job_fails(self):
        for result in ["failure", "skipped", "cancelled", ""]:
            with self.subTest(result=result):
                self.assertTrue(failures("success", result, "success", True, True))
                self.assertTrue(failures("success", "success", result, True, True))

    def test_contract_failure_cannot_be_hidden_by_skips(self):
        self.assertTrue(failures("failure", "skipped", "skipped", False, False))

    def test_optional_job_failure_is_not_ignored(self):
        self.assertTrue(failures("success", "failure", "skipped", False, False))

    def test_missing_selection_fails_closed(self):
        result = subprocess.run(
            [sys.executable, str(Path(__file__).with_name("ci_gate.py"))],
            env={"CONTRACT_RESULT": "success", "FRONTEND_RESULT": "skipped", "IMAGE_RESULT": "skipped"},
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("missing or invalid check selection", result.stderr)


class EventDiffTests(unittest.TestCase):
    def test_push_range_includes_frontend_before_later_docs_commit(self):
        with tempfile.TemporaryDirectory() as directory, contextlib.chdir(directory):
            def git(*args):
                return subprocess.check_output(["git", *args], stderr=subprocess.DEVNULL).decode().strip()

            def commit():
                git("add", ".")
                git("-c", "user.name=CI fixture", "-c", "user.email=ci@example.invalid",
                    "-c", "commit.gpgsign=false", "commit", "-m", "fixture")
                return git("rev-parse", "HEAD")

            git("init")
            Path("README.md").write_text("initial\n")
            base = commit()
            Path("frontend").mkdir()
            Path("frontend/app.ts").write_text("export const value = 1;\n")
            commit()
            Path("README.md").write_text("later docs change\n")
            head = commit()
            with patch.dict(os.environ, {"CI_BEFORE": base, "CI_SHA": head}):
                paths = changed_paths("push")
            self.assertEqual(set(paths), {"README.md", "frontend/app.ts"})
            self.assertTrue(plan(paths, "push", "refs/heads/main")["publish"])


if __name__ == "__main__":
    unittest.main()
