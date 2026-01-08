"""Add rubric, evaluation and weighting tables

Revision ID: 20260107_001
Revises: 612de6b9d598
Create Date: 2026-01-07 22:01:28.638550

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260107_001'
down_revision: Union[str, Sequence[str], None] = '612de6b9d598'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create rubric_templates table
    op.create_table(
        'rubric_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('course_exercise_id', sa.Integer(), nullable=False),
        sa.Column('therapist_id', sa.Integer(), nullable=False),
        sa.Column('max_score', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['course_exercise_id'], ['course_exercises.id'], ),
        sa.ForeignKeyConstraint(['therapist_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('course_exercise_id', name='uq_rubric_course_exercise')
    )
    op.create_index(op.f('ix_rubric_templates_id'), 'rubric_templates', ['id'], unique=False)

    # Create rubric_criteria table
    op.create_table(
        'rubric_criteria',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('rubric_template_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('max_points', sa.Integer(), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['rubric_template_id'], ['rubric_templates.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_rubric_criteria_id'), 'rubric_criteria', ['id'], unique=False)

    # Create rubric_levels table
    op.create_table(
        'rubric_levels',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('rubric_criteria_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('points', sa.Integer(), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['rubric_criteria_id'], ['rubric_criteria.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_rubric_levels_id'), 'rubric_levels', ['id'], unique=False)

    # Create evaluations table
    op.create_table(
        'evaluations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('submission_id', sa.Integer(), nullable=False),
        sa.Column('rubric_template_id', sa.Integer(), nullable=False),
        sa.Column('therapist_id', sa.Integer(), nullable=False),
        sa.Column('total_score', sa.Integer(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['rubric_template_id'], ['rubric_templates.id'], ),
        sa.ForeignKeyConstraint(['submission_id'], ['submissions.id'], ),
        sa.ForeignKeyConstraint(['therapist_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('submission_id', name='uq_evaluation_submission')
    )
    op.create_index(op.f('ix_evaluations_id'), 'evaluations', ['id'], unique=False)

    # Create evaluation_criterion_scores table
    op.create_table(
        'evaluation_criterion_scores',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('evaluation_id', sa.Integer(), nullable=False),
        sa.Column('rubric_criteria_id', sa.Integer(), nullable=False),
        sa.Column('rubric_level_id', sa.Integer(), nullable=False),
        sa.Column('points_awarded', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['evaluation_id'], ['evaluations.id'], ),
        sa.ForeignKeyConstraint(['rubric_criteria_id'], ['rubric_criteria.id'], ),
        sa.ForeignKeyConstraint(['rubric_level_id'], ['rubric_levels.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_evaluation_criterion_scores_id'), 'evaluation_criterion_scores', ['id'], unique=False)

    # Create exercise_weightings table
    op.create_table(
        'exercise_weightings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('course_exercise_id', sa.Integer(), nullable=False),
        sa.Column('therapist_id', sa.Integer(), nullable=False),
        sa.Column('weight', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['course_exercise_id'], ['course_exercises.id'], ),
        sa.ForeignKeyConstraint(['therapist_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('course_exercise_id', name='uq_weighting_course_exercise')
    )
    op.create_index(op.f('ix_exercise_weightings_id'), 'exercise_weightings', ['id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_exercise_weightings_id'), table_name='exercise_weightings')
    op.drop_table('exercise_weightings')
    op.drop_index(op.f('ix_evaluation_criterion_scores_id'), table_name='evaluation_criterion_scores')
    op.drop_table('evaluation_criterion_scores')
    op.drop_index(op.f('ix_evaluations_id'), table_name='evaluations')
    op.drop_table('evaluations')
    op.drop_index(op.f('ix_rubric_levels_id'), table_name='rubric_levels')
    op.drop_table('rubric_levels')
    op.drop_index(op.f('ix_rubric_criteria_id'), table_name='rubric_criteria')
    op.drop_table('rubric_criteria')
    op.drop_index(op.f('ix_rubric_templates_id'), table_name='rubric_templates')
    op.drop_table('rubric_templates')
