"""classroom_refactor

Revision ID: c1d2e3f4a5b6
Revises: a1f4c9d2b7e0
Create Date: 2026-06-02 12:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, Sequence[str], None] = "a1f4c9d2b7e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. New teacher_classrooms junction table
    op.create_table(
        "teacher_classrooms",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("teacher_id", sa.Integer(), nullable=False),
        sa.Column("classroom_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["classroom_id"], ["classes.id"], name="fk_teacher_classrooms_classroom_id"),
        sa.ForeignKeyConstraint(["teacher_id"], ["users.id"], name="fk_teacher_classrooms_teacher_id"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("teacher_id", "classroom_id", name="uq_teacher_classrooms"),
    )
    op.create_index("ix_teacher_classrooms_teacher_id", "teacher_classrooms", ["teacher_id"])
    op.create_index("ix_teacher_classrooms_classroom_id", "teacher_classrooms", ["classroom_id"])

    # 2. Add classroom_id FK to users (students only, nullable)
    op.add_column("users", sa.Column("classroom_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_users_classroom_id", "users", "classes", ["classroom_id"], ["id"])
    op.create_index("ix_users_classroom_id", "users", ["classroom_id"])

    # 3. Rename admin_code -> teacher_code
    op.alter_column("users", "admin_code", new_column_name="teacher_code")

    # 4. Add created_by FK to classes
    op.add_column("classes", sa.Column("created_by", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_classes_created_by", "classes", "users", ["created_by"], ["id"])

    # --- Data migration ---

    # 5a. Populate teacher_classrooms from existing user_classes (teacher rows)
    op.execute("""
        INSERT INTO teacher_classrooms (teacher_id, classroom_id)
        SELECT uc.user_id, uc.class_id
        FROM user_classes uc
        JOIN users u ON u.id = uc.user_id
        WHERE u.role = 'teacher'
        ON CONFLICT (teacher_id, classroom_id) DO NOTHING
    """)

    # 5b. Set classroom_id on student users from user_classes
    op.execute("""
        UPDATE users
        SET classroom_id = sub.class_id
        FROM (
            SELECT DISTINCT ON (user_id) user_id, class_id
            FROM user_classes
            ORDER BY user_id, class_id ASC
        ) sub
        WHERE users.id = sub.user_id
          AND users.role = 'student'
    """)

    # 5c. Set created_by on classrooms from the earliest teacher_classes record
    op.execute("""
        UPDATE classes
        SET created_by = tc.teacher_id
        FROM (
            SELECT DISTINCT ON (class_code) teacher_id, class_code
            FROM teacher_classes
            ORDER BY class_code, id ASC
        ) tc
        WHERE classes.code = tc.class_code
          AND classes.created_by IS NULL
    """)

    # 6. Drop obsolete tables and column
    op.drop_table("user_classes")
    op.drop_table("teacher_classes")
    op.drop_column("users", "class_code")


def downgrade() -> None:
    # Restore class_code column
    op.add_column("users", sa.Column("class_code", sa.String(length=50), nullable=True))
    op.execute("""
        UPDATE users
        SET class_code = c.code
        FROM classes c
        WHERE users.classroom_id = c.id
          AND users.role = 'student'
    """)

    # Restore teacher_classes table
    op.create_table(
        "teacher_classes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("teacher_id", sa.Integer(), nullable=False),
        sa.Column("class_code", sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(["teacher_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute("""
        INSERT INTO teacher_classes (teacher_id, class_code)
        SELECT tc.teacher_id, c.code
        FROM teacher_classrooms tc
        JOIN classes c ON c.id = tc.classroom_id
    """)

    # Restore user_classes table
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
    op.execute("""
        INSERT INTO user_classes (user_id, class_id)
        SELECT tc.teacher_id, tc.classroom_id FROM teacher_classrooms tc
        UNION
        SELECT u.id, u.classroom_id FROM users u WHERE u.role = 'student' AND u.classroom_id IS NOT NULL
        ON CONFLICT (user_id, class_id) DO NOTHING
    """)

    # Rename teacher_code back to admin_code
    op.alter_column("users", "teacher_code", new_column_name="admin_code")

    # Drop new columns and tables
    op.drop_constraint("fk_classes_created_by", "classes", type_="foreignkey")
    op.drop_column("classes", "created_by")

    op.drop_constraint("fk_users_classroom_id", "users", type_="foreignkey")
    op.drop_index("ix_users_classroom_id", table_name="users")
    op.drop_column("users", "classroom_id")

    op.drop_index("ix_teacher_classrooms_classroom_id", table_name="teacher_classrooms")
    op.drop_index("ix_teacher_classrooms_teacher_id", table_name="teacher_classrooms")
    op.drop_table("teacher_classrooms")
