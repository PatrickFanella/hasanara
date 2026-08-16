from __future__ import annotations

import json

import pytest

from app.archive.chapter_review import list_chapter_candidate_sets, review_chapter_set
from app.exceptions import ValidationError


class _Result:
    def __init__(self, rows=None):
        self.rows = rows or []

    def mappings(self):
        return self

    def all(self):
        return self.rows


def _chapters():
    return [
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "video_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "chapter_index": 0,
            "start_ms": 0,
            "end_ms": 300_000,
            "title": "Opening News Discussion",
            "summary": "The stream opens with a sustained news discussion.",
            "confidence_score": 0.75,
            "status": "candidate",
            "source": "automatic",
            "evidence": [{"block_index": 0, "start_ms": 0, "end_ms": 60_000, "text": "News discussion"}],
        },
        {
            "id": "22222222-2222-2222-2222-222222222222",
            "video_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "chapter_index": 1,
            "start_ms": 300_000,
            "end_ms": 600_000,
            "title": "Housing Policy Debate",
            "summary": "The conversation moves to housing policy.",
            "confidence_score": 0.75,
            "status": "candidate",
            "source": "automatic",
            "evidence": [{"block_index": 1, "start_ms": 300_000, "end_ms": 360_000, "text": "Housing policy"}],
        },
    ]


class _Db:
    def __init__(self, chapters=None):
        self.chapters = chapters or _chapters()
        self.calls = []

    def execute(self, statement, params=None):
        sql = str(statement)
        params = params or {}
        self.calls.append((sql, params))
        if "FROM videos WHERE id" in sql:
            return _Result([{"id": params["video_id"], "duration_seconds": 600}])
        if "FROM archive_video_chapters" in sql and "FOR UPDATE" in sql:
            return _Result([dict(chapter) for chapter in self.chapters])
        if "WITH selected_videos" in sql:
            return _Result(
                [
                    {
                        **chapter,
                        "youtube_id": "yt-1",
                        "video_title": "A review VOD",
                        "duration_seconds": 600,
                        "pipeline_version": "pipeline-v2",
                        "model_name": "model",
                        "prompt_version": "prompt-v2",
                        "transcript_source": "youtube",
                        "run_id": None,
                        "created_at": None,
                        "updated_at": None,
                    }
                    for chapter in self.chapters
                ]
            )
        return _Result()


def test_list_chapter_candidates_groups_complete_episode_and_decodes_evidence():
    db = _Db()
    db.chapters[0]["evidence"] = json.dumps(db.chapters[0]["evidence"])

    sets = list_chapter_candidate_sets(db)

    assert len(sets) == 1
    assert sets[0]["video_title"] == "A review VOD"
    assert [chapter["chapter_index"] for chapter in sets[0]["chapters"]] == [0, 1]
    assert sets[0]["chapters"][0]["evidence"][0]["text"] == "News discussion"


def test_publish_chapter_set_atomically_recomputes_ends_and_audits_edits():
    db = _Db()

    reviewed = review_chapter_set(
        db,
        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        action="publish",
        edits=[
            {
                "id": "22222222-2222-2222-2222-222222222222",
                "start_ms": 360_000,
                "title": "Rent and Housing Policy",
            }
        ],
        reason="Boundary follows the topic transition",
        user_id="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    )

    updates = [(sql, params) for sql, params in db.calls if "UPDATE archive_video_chapters" in sql]
    feedback = [(sql, params) for sql, params in db.calls if "INSERT INTO archive_chapter_feedback" in sql]
    assert updates[0][1]["end_ms"] == 360_000
    assert updates[1][1]["start_ms"] == 360_000
    assert updates[1][1]["source"] == "hybrid"
    assert [item[1]["action"] for item in feedback] == ["publish", "boundary_adjust", "publish"]
    assert [chapter["status"] for chapter in reviewed] == ["published", "published"]


def test_invalid_chapter_boundary_is_rejected_before_any_update():
    db = _Db()

    with pytest.raises(ValidationError, match="first chapter"):
        review_chapter_set(
            db,
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            action="publish",
            edits=[{"id": "11111111-1111-1111-1111-111111111111", "start_ms": 1_000}],
        )

    assert not any("UPDATE archive_video_chapters" in sql for sql, _params in db.calls)


def test_too_short_final_chapter_is_rejected_before_any_update():
    db = _Db()

    with pytest.raises(ValidationError, match="at least 30 seconds"):
        review_chapter_set(
            db,
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            action="publish",
            edits=[{"id": "22222222-2222-2222-2222-222222222222", "start_ms": 590_000}],
        )

    assert not any("UPDATE archive_video_chapters" in sql for sql, _params in db.calls)


def test_reject_chapter_set_records_feedback_for_every_candidate():
    db = _Db()

    reviewed = review_chapter_set(
        db,
        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        action="reject",
        reason="Outline is not coherent",
    )

    feedback = [params for sql, params in db.calls if "INSERT INTO archive_chapter_feedback" in sql]
    assert [item["action"] for item in feedback] == ["reject", "reject"]
    assert [chapter["status"] for chapter in reviewed] == ["rejected", "rejected"]


def test_reject_chapter_set_requires_a_feedback_reason_before_any_update():
    db = _Db()

    with pytest.raises(ValidationError, match="review note"):
        review_chapter_set(
            db,
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            action="reject",
            reason="   ",
        )

    assert not any("UPDATE archive_video_chapters" in sql for sql, _params in db.calls)
