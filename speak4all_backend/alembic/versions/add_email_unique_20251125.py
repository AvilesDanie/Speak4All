"""add unique constraint to users.email

Revision ID: 20251125_add_unique_email_to_users
Revises: a1b2c3d4e5f6
Create Date: 2025-11-25 15:30:00

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '20251125_add_unique_email_to_users'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None

def upgrade():
    op.create_unique_constraint('uq_users_email', 'users', ['email'])

def downgrade():
    op.drop_constraint('uq_users_email', 'users', type_='unique')


revision = 'add_email_unique_20251125'
down_revision = 'a1b2c3d4e5f6'