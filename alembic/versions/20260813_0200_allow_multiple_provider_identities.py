"""allow multiple identities from the same provider per user

Revision ID: 20260813_multi_provider_ids
Revises: 20260813_feed_keysets
Create Date: 2026-08-13 16:00:00
"""

from collections.abc import Sequence
from typing import Union

from alembic import op

revision: str = "20260813_multi_provider_ids"
down_revision: Union[str, None] = "20260813_feed_keysets"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("user_identities_user_id_provider_key", "user_identities", type_="unique")
    op.create_index(
        "user_identities_user_provider_idx",
        "user_identities",
        ["user_id", "provider"],
        unique=False,
    )


def downgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM user_identities
                GROUP BY user_id, provider
                HAVING count(*) > 1
            ) THEN
                RAISE EXCEPTION
                    'cannot restore rc.8 identity constraint while duplicate-provider identities exist';
            END IF;
        END $$;
    """)
    op.drop_index("user_identities_user_provider_idx", table_name="user_identities")
    op.create_unique_constraint(
        "user_identities_user_id_provider_key",
        "user_identities",
        ["user_id", "provider"],
    )
