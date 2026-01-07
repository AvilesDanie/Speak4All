"""change_audio_path_to_media_path_in_submissions

Revision ID: bfc4031dfe09
Revises: 612de6b9d598
Create Date: 2026-01-07 16:30:30.587895

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bfc4031dfe09'
down_revision: Union[str, Sequence[str], None] = '612de6b9d598'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Renombrar columna audio_path a media_path y hacerla NOT NULL
    # Primero agregar la nueva columna como nullable
    op.add_column('submissions', sa.Column('media_path', sa.String(), nullable=True))
    
    # Copiar datos existentes de audio_path a media_path
    op.execute('UPDATE submissions SET media_path = audio_path WHERE audio_path IS NOT NULL')
    
    # Eliminar la columna antigua
    op.drop_column('submissions', 'audio_path')
    
    # Hacer la columna NOT NULL (las submissions existentes que no ten\u00edan audio ser\u00e1n eliminadas o migradas manualmente)
    op.alter_column('submissions', 'media_path', nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Revertir: media_path -> audio_path (nullable)
    op.add_column('submissions', sa.Column('audio_path', sa.String(), nullable=True))
    op.execute('UPDATE submissions SET audio_path = media_path WHERE media_path IS NOT NULL')
    op.drop_column('submissions', 'media_path')
