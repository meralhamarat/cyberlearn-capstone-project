"""add_classes_and_user_classes

Revision ID: a1f4c9d2b7e0
Revises: 2b0652d86fbf
Create Date: 2026-06-02 11:50:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1f4c9d2b7e0"
down_revision: Union[str, Sequence[str], None] = "2b0652d86fbf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "classes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=True),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(op.f("ix_classes_code"), "classes", ["code"], unique=True)

    op.create_table(
        "user_classes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("class_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "class_id", name="uq_user_classes_user_id_class_id"),
    )
    op.create_index(op.f("ix_user_classes_user_id"), "user_classes", ["user_id"], unique=False)
    op.create_index(op.f("ix_user_classes_class_id"), "user_classes", ["class_id"], unique=False)

    # 1) classes tablosunu mevcut code'lardan doldur
    op.execute(
        """
        INSERT INTO classes (name, code)
        SELECT DISTINCT u.class_code, u.class_code
        FROM users u
        WHERE u.class_code IS NOT NULL AND u.class_code <> ''
        ON CONFLICT (code) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO classes (name, code)
        SELECT DISTINCT tc.class_code, tc.class_code
        FROM teacher_classes tc
        WHERE tc.class_code IS NOT NULL AND tc.class_code <> ''
        ON CONFLICT (code) DO NOTHING
        """
    )

    # 2) öğrenci sınıf ilişkilerini taşı
    op.execute(
        """
        INSERT INTO user_classes (user_id, class_id)
        SELECT u.id, c.id
        FROM users u
        JOIN classes c ON c.code = u.class_code
        WHERE u.role = 'student' AND u.class_code IS NOT NULL AND u.class_code <> ''
        ON CONFLICT (user_id, class_id) DO NOTHING
        """
    )

    # 3) öğretmen sınıf ilişkilerini taşı
    op.execute(
        """
        INSERT INTO user_classes (user_id, class_id)
        SELECT tc.teacher_id, c.id
        FROM teacher_classes tc
        JOIN classes c ON c.code = tc.class_code
        ON CONFLICT (user_id, class_id) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_user_classes_class_id"), table_name="user_classes")
    op.drop_index(op.f("ix_user_classes_user_id"), table_name="user_classes")
    op.drop_table("user_classes")
    op.drop_index(op.f("ix_classes_code"), table_name="classes")
    op.drop_table("classes")
