"""add chapter review provenance and feedback

Revision ID: 20260815_chapter_review
Revises: 20260813_multi_provider_ids
Create Date: 2026-08-15 09:00:00
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260815_chapter_review"
down_revision: Union[str, None] = "20260813_multi_provider_ids"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "archive_video_chapters",
        sa.Column(
            "evidence",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column("archive_video_chapters", sa.Column("pipeline_version", sa.Text(), nullable=True))
    op.add_column("archive_video_chapters", sa.Column("model_name", sa.Text(), nullable=True))
    op.add_column("archive_video_chapters", sa.Column("prompt_version", sa.Text(), nullable=True))
    op.add_column("archive_video_chapters", sa.Column("transcript_source", sa.Text(), nullable=True))
    op.create_check_constraint(
        "archive_video_chapters_transcript_source_check",
        "archive_video_chapters",
        "transcript_source IS NULL OR transcript_source IN ('whisper', 'youtube')",
    )

    op.create_table(
        "archive_chapter_feedback",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "chapter_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("archive_video_chapters.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "video_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("videos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column(
            "old_value",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "new_value",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "action IN ('publish', 'reject', 'edit', 'boundary_adjust')",
            name="archive_chapter_feedback_action_check",
        ),
    )
    op.create_index(
        "archive_chapter_feedback_video_created_idx",
        "archive_chapter_feedback",
        ["video_id", "created_at"],
    )
    op.create_index(
        "archive_video_chapters_status_video_idx",
        "archive_video_chapters",
        ["status", "video_id", "chapter_index"],
    )

    # Old imports did not consistently mark collisions. A duplicated normalized
    # alias is definitionally unsafe for automatic resolution.
    op.execute("""
        UPDATE archive_label_aliases AS alias
        SET is_ambiguous = true
        WHERE EXISTS (
            SELECT 1
            FROM archive_label_aliases AS competing
            WHERE competing.normalized_alias = alias.normalized_alias
              AND competing.label_id <> alias.label_id
              AND competing.status = 'active'
        )
        """)


def downgrade() -> None:
    op.drop_index("archive_video_chapters_status_video_idx", table_name="archive_video_chapters")
    op.drop_index("archive_chapter_feedback_video_created_idx", table_name="archive_chapter_feedback")
    op.drop_table("archive_chapter_feedback")
    op.drop_constraint(
        "archive_video_chapters_transcript_source_check",
        "archive_video_chapters",
        type_="check",
    )
    op.drop_column("archive_video_chapters", "transcript_source")
    op.drop_column("archive_video_chapters", "prompt_version")
    op.drop_column("archive_video_chapters", "model_name")
    op.drop_column("archive_video_chapters", "pipeline_version")
    op.drop_column("archive_video_chapters", "evidence")
