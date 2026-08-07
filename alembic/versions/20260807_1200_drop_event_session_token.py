"""drop obsolete event session token

Revision ID: 20260807_event_token
Revises: 20260714_0300
Create Date: 2026-08-07 12:00:00.000000

"""

import os
from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa

from alembic import op

revision: str = "20260807_event_token"
down_revision: Union[str, None] = "20260714_0300"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if os.environ.get("ALLOW_EVENT_TOKEN_CONTRACT_MIGRATION", "").strip().lower() != "true":
        raise RuntimeError(
            "20260807_event_token irreversibly discards historical event bearer tokens. "
            "Set ALLOW_EVENT_TOKEN_CONTRACT_MIGRATION=true only after all API instances omit the column "
            "and a database backup has completed."
        )
    op.drop_column("events", "session_token")


def downgrade() -> None:
    # Historical bearer tokens were deliberately discarded and cannot be restored.
    op.add_column("events", sa.Column("session_token", sa.Text(), nullable=True))
