"""add feed keyset indexes

Revision ID: 20260813_feed_keysets
Revises: 20260808_account_merge
Create Date: 2026-08-13 09:30:00
"""

from collections.abc import Sequence
from typing import Union

from alembic import op

revision: str = "20260813_feed_keysets"
down_revision: Union[str, None] = "20260808_account_merge"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS videos_feed_latest_idx "
            "ON videos ((COALESCE(uploaded_at, created_at)) DESC, id DESC)"
        )
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS videos_feed_duration_idx "
            "ON videos (duration_seconds DESC NULLS LAST, id DESC)"
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS videos_feed_duration_idx")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS videos_feed_latest_idx")
