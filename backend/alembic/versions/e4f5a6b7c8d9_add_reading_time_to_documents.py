"""add_reading_time_to_documents

Revision ID: e4f5a6b7c8d9
Revises: d3ca9d13a6ec
Create Date: 2026-06-10

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e4f5a6b7c8d9'
down_revision: Union[str, Sequence[str], None] = 'd3ca9d13a6ec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('documents', sa.Column('reading_time_seconds', sa.Integer(), nullable=True, server_default='90'))


def downgrade() -> None:
    op.drop_column('documents', 'reading_time_seconds')
