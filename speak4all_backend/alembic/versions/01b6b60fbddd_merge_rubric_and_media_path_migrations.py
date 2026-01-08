"""merge rubric and media path migrations

Revision ID: 01b6b60fbddd
Revises: 20260107_001, bfc4031dfe09
Create Date: 2026-01-07 18:53:15.962763

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '01b6b60fbddd'
down_revision: Union[str, Sequence[str], None] = ('20260107_001', 'bfc4031dfe09')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
