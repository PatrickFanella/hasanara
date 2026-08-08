"""Queue selection policy for native transcription work."""

from worker.state_model import pending_video_eligibility_sql


def pending_video_claim_sql() -> str:
    """Select each video once its individual caption state is terminal."""
    return f"""
                SELECT v.id, j.id AS job_id
                {pending_video_eligibility_sql()}
                ORDER BY
                  CASE
                    WHEN EXISTS (SELECT 1 FROM youtube_transcripts yt WHERE yt.video_id = v.id) THEN 1
                    ELSE 0
                  END ASC,
                  v.idx ASC NULLS LAST,
                  v.created_at DESC
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            """
