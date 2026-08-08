"""Database maintenance performed between worker queue claims."""

from sqlalchemy import text

from worker.state_model import VideoState

MODEL_RANKS = {
    "tiny": 1,
    "base": 2,
    "small": 3,
    "medium": 4,
    "large": 5,
    "large-v2": 6,
    "large-v3": 7,
}


def rescue_stuck_videos(conn, *, after_seconds: int) -> None:
    if after_seconds <= 0:
        return
    conn.execute(
        text("""
            UPDATE videos
            SET state = 'pending', updated_at = now()
            WHERE state IN ('downloading','transcoding','transcribing')
              AND (diarization_error IS NULL OR diarization_error NOT LIKE 'canary-%')
              AND now() - updated_at > make_interval(secs => :secs)
            RETURNING id
        """),
        {"secs": after_seconds},
    )


def requeue_for_model_upgrade(conn, *, current_model: str) -> list:
    current_rank = MODEL_RANKS.get(current_model, 0)
    if current_rank <= 0:
        return []
    result = conn.execute(
        text("""
            UPDATE videos v
            SET state = 'pending', updated_at=now()
            FROM transcripts t
            WHERE v.id = t.video_id
              AND v.state = :completed_state
              AND (v.diarization_error IS NULL OR v.diarization_error NOT LIKE 'canary-%')
              AND t.model IS NOT NULL
              AND CASE
                    WHEN t.model = 'tiny' THEN 1
                    WHEN t.model = 'base' THEN 2
                    WHEN t.model = 'small' THEN 3
                    WHEN t.model = 'medium' THEN 4
                    WHEN t.model = 'large' THEN 5
                    WHEN t.model = 'large-v2' THEN 6
                    WHEN t.model = 'large-v3' THEN 7
                    ELSE 0
                  END < :current_rank
            RETURNING v.id, t.model
        """),
        {"current_rank": current_rank, "completed_state": VideoState.COMPLETED.value},
    )
    return list(result.fetchall())
