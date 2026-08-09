from __future__ import annotations

import json

from scripts.enrich_archive_video import main


def test_enrich_archive_video_cli_processes_explicit_ids_and_closes_session(monkeypatch, capsys):
    calls = []

    class _Db:
        closed = False

        def close(self):
            self.closed = True

    db = _Db()
    monkeypatch.setattr("scripts.enrich_archive_video.SessionLocal", lambda: db)
    monkeypatch.setattr(
        "scripts.enrich_archive_video.enrich_video_candidates",
        lambda session, video_id: calls.append((session, video_id))
        or {"model": "deepseek/deepseek-v4-pro", "chapters": 12, "cost_usd": 0.02},
    )

    assert main(["--video-id", "video-1", "--video-id", "video-2"]) == 0

    assert calls == [(db, "video-1"), (db, "video-2")]
    assert db.closed
    output = [json.loads(line) for line in capsys.readouterr().out.splitlines()]
    assert [item["video_id"] for item in output] == ["video-1", "video-2"]
    assert all(item["status"] == "completed" for item in output)
