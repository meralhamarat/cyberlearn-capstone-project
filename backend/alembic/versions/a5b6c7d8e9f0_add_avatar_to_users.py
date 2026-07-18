"""add_avatar_to_users

Revision ID: a5b6c7d8e9f0
Revises: f5g6h7i8j9k0
Create Date: 2026-06-12

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a5b6c7d8e9f0'
down_revision: Union[str, Sequence[str], None] = 'f5g6h7i8j9k0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('avatar', sa.String(50), nullable=True, server_default='warrior-1'))


def downgrade() -> None:
    op.drop_column('users', 'avatar')
