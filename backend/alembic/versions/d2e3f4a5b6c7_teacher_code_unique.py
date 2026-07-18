"""teacher_code_unique

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-06-02 13:00:00.000000
"""
from typing import Sequence, Union
from alembic import op

revision: str = "d2e3f4a5b6c7"
down_revision: Union[str, Sequence[str], None] = "c1d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_users_teacher_code_unique",
        "users",
        ["teacher_code"],
        unique=True,
        postgresql_where="teacher_code IS NOT NULL",
    )


def downgrade() -> None:
    op.drop_index("ix_users_teacher_code_unique", table_name="users")
