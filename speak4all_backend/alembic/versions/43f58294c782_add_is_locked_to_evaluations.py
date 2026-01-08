"""add_is_locked_to_evaluations

Revision ID: 43f58294c782
Revises: 01b6b60fbddd
Create Date: 2026-01-07 22:38:57.596976

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '43f58294c782'
down_revision: Union[str, Sequence[str], None] = '01b6b60fbddd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('evaluations', sa.Column('is_locked', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('evaluations', 'is_locked')
