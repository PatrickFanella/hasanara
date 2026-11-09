"""Loopback-only generated clip producer for the optional handoff journey.

Uses the pinned core's routes, snapshot, original registration and real renderer.
SQLite and a fixed fixture owner replace production persistence and sessions.
No network media acquisition or production application startup is involved.
"""

import os
from pathlib import Path
import subprocess
import sys
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "core"))
os.environ["DATABASE_URL"] = "sqlite://"

from fastapi import FastAPI  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402
import uvicorn  # noqa: E402

from app.clip_exports import ClipStore  # noqa: E402
from app.clip_handoff import build_handoff, snapshot_transcript  # noqa: E402
from app.db import get_db  # noqa: E402
from app.routes.clips import router, store  # noqa: E402
from app.routes.passages import passage_urls  # noqa: E402
from app.security import require_auth  # noqa: E402
from app.settings import settings  # noqa: E402

VIDEO = "00000000-0000-0000-0000-000000000201"
OWNER = "00000000-0000-0000-0000-000000000601"


def main():
    with tempfile.TemporaryDirectory(prefix="hasanara-handoff-fixture-") as directory:
        root = Path(directory)
        originals = root / "originals"
        originals.mkdir()
        media = originals / "generated.mp4"
        subprocess.run([
            "ffmpeg", "-nostdin", "-loglevel", "error", "-f", "lavfi", "-i",
            "testsrc2=size=320x240:rate=25", "-f", "lavfi", "-i",
            "sine=frequency=440:sample_rate=44100", "-t", "3", "-c:v", "libx264",
            "-threads", "1", "-c:a", "aac", str(media),
        ], check=True, timeout=30)
        engine = create_engine(f"sqlite:///{root / 'fixture.db'}", connect_args={"check_same_thread": False})
        with engine.begin() as db:
            for sql in [
                "CREATE TABLE videos (id TEXT, youtube_id TEXT, duration_seconds INTEGER)",
                "CREATE TABLE transcripts (id TEXT, video_id TEXT, language TEXT, created_at TEXT)",
                "CREATE TABLE segments (id INTEGER, video_id TEXT, transcript_id TEXT, start_ms INTEGER, end_ms INTEGER, text TEXT)",
                "CREATE TABLE audit_logs (user_id TEXT, action TEXT, resource_type TEXT, resource_id TEXT, success BOOLEAN, details TEXT, ip_address TEXT, user_agent TEXT)",
            ]:
                db.execute(text(sql))
            db.execute(text("INSERT INTO videos VALUES (:id, 'BaW_jenozKc', 3)"), {"id": VIDEO})
            db.execute(text("INSERT INTO transcripts VALUES (:id, :video, 'en', '2026-11-09')"), {"id": OWNER, "video": VIDEO})
            db.execute(text("INSERT INTO segments VALUES (1, :video, :transcript, 0, 3000, 'Generated fixture caption.')"), {"video": VIDEO, "transcript": OWNER})
        clips = ClipStore(root / "spool", originals)
        clips.register(VIDEO, OWNER, media, "Generated test pattern; no creator media", timeline_aligned=True)
        with Session(engine) as db:
            provenance = snapshot_transcript(db, VIDEO, 500, 2500)
        provenance["youtube_id"] = "BaW_jenozKc"
        job = clips.enqueue(VIDEO, OWNER, 500, 2500, provenance=provenance)
        completed = clips.run(job["id"])
        assert completed["status"] == "completed", completed
        settings.FRONTEND_ORIGIN = "https://archive.example"
        settings.CLIP_EXPORTS_ENABLED = True
        settings.CLIP_EXPORT_SOURCE = "original"
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[store] = lambda: clips
        app.dependency_overrides[require_auth] = lambda: {"id": OWNER, "role": "user"}

        def database():
            with Session(engine) as db:
                yield db

        app.dependency_overrides[get_db] = database

        @app.get("/fixture")
        def fixture():
            passage, _, player = passage_urls(uuid.UUID(VIDEO), 500, 2500)
            return build_handoff(completed, passage_url=passage, player_url=player,
                                 origin="https://archive.example", site_name=settings.SITE_NAME)

        uvicorn.run(app, host="127.0.0.1", port=41861, log_level="warning")


if __name__ == "__main__":
    main()
