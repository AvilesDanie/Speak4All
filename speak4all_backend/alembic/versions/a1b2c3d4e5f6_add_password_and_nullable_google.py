"""
Add password_hash to users and make google_sub nullable

Revision ID: a1b2c3d4e5f6
Revises: bd4a34461471
Create Date: 2025-11-25 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'bd4a34461471'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add password_hash column (nullable)
    op.add_column('users', sa.Column('password_hash', sa.String(), nullable=True))
    # Make google_sub nullable
    op.alter_column('users', 'google_sub', existing_type=sa.String(), nullable=True)


def downgrade() -> None:
    # Revert google_sub to non-nullable (may fail if nulls exist)
    op.alter_column('users', 'google_sub', existing_type=sa.String(), nullable=False)
    # Drop password_hash
    op.drop_column('users', 'password_hash')
