from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, Text,
    Enum, UniqueConstraint
)
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from .database import Base


def utcnow():
    return datetime.now(timezone.utc)


class UserRole(str, enum.Enum):
    THERAPIST = "THERAPIST"
    STUDENT = "STUDENT"


class JoinRequestStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"


class SubmissionStatus(str, enum.Enum):
    PENDING = "PENDING"
    DONE = "DONE"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    # ID de Google (puede ser nulo si el usuario usa solo email/contraseña)
    google_sub = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    # Autenticación local
    password_hash = Column(String, nullable=True)
    # Foto de perfil (ruta relativa en media/avatars/)
    avatar_path = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    is_active = Column(Boolean, default=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    courses_owned = relationship("Course", back_populates="therapist")


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True)
    therapist_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    join_code = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    is_active = Column(Boolean, default=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    therapist = relationship("User", back_populates="courses_owned")
    students = relationship("CourseStudent", back_populates="course")
    exercises = relationship("CourseExercise", back_populates="course")


class CourseJoinRequest(Base):
    __tablename__ = "course_join_requests"

    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(JoinRequestStatus), default=JoinRequestStatus.PENDING, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    decided_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("course_id", "student_id", name="uniq_join_request"),
    )


class CourseStudent(Base):
    __tablename__ = "course_students"

    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    joined_at = Column(DateTime(timezone=True), default=utcnow)
    is_active = Column(Boolean, default=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    course = relationship("Course", back_populates="students")


class Exercise(Base):
    """
    Ejercicio base creado por un terapeuta (texto + audio).
    Luego se puede publicar en uno o varios cursos (CourseExercise).
    """
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True)
    therapist_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    folder_id = Column(Integer, ForeignKey("exercise_folders.id"), nullable=True)
    name = Column(String, nullable=False)
    prompt = Column(Text, nullable=True)         # prompt usado con IA
    text = Column(Text, nullable=False)         # texto final del ejercicio
    audio_path = Column(String, nullable=False) # path relativo del mp3
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow)
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    folder = relationship("ExerciseFolder", back_populates="exercises")


class ExerciseCategory(Base):
    """
    Categoría de ejercicio creada por el terapeuta.
    Sirve para clasificar ejercicios (ej: "Pronunciación", "Vocabulario", "Comprensión").
    """
    __tablename__ = "exercise_categories"

    id = Column(Integer, primary_key=True)
    therapist_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String, nullable=True)  # Código de color hex para UI
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow)
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    therapist = relationship("User")


class CourseExercise(Base):
    """
    Publicación de un ejercicio en un curso.
    """
    __tablename__ = "course_exercises"

    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("exercise_categories.id"), nullable=True)
    published_at = Column(DateTime(timezone=True), default=utcnow)
    due_date = Column(DateTime(timezone=True), nullable=True)
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    course = relationship("Course", back_populates="exercises")
    exercise = relationship("Exercise")
    category = relationship("ExerciseCategory")


class Submission(Base):
    """
    Entrega del estudiante: requiere evidencia obligatoria (foto o video).
    """
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    course_exercise_id = Column(Integer, ForeignKey("course_exercises.id"), nullable=False)
    status = Column(Enum(SubmissionStatus), default=SubmissionStatus.DONE, nullable=False)
    media_path = Column(String, nullable=False)  # Ruta de foto o video (obligatorio)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow)

    # lógica de tiempo límite se hará en código (no aquí)


class Observation(Base):
    """
    Observaciones del terapeuta sobre la entrega de un estudiante.
    """
    __tablename__ = "observations"

    id = Column(Integer, primary_key=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    therapist_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow)
    is_deleted = Column(Boolean, default=False)


class RubricTemplate(Base):
    """
    Plantilla de rúbrica para un ejercicio.
    Cada ejercicio tiene una rúbrica por defecto pero puede personalizarse por curso.
    """
    __tablename__ = "rubric_templates"

    id = Column(Integer, primary_key=True)
    course_exercise_id = Column(Integer, ForeignKey("course_exercises.id"), nullable=False, unique=True)
    therapist_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    max_score = Column(Integer, nullable=False, default=100)  # Puntuación máxima
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow)
    is_deleted = Column(Boolean, default=False)

    course_exercise = relationship("CourseExercise")
    criteria = relationship("RubricCriteria", back_populates="template", cascade="all, delete-orphan")


class RubricCriteria(Base):
    """
    Criterios individuales dentro de una rúbrica.
    Ej: "Pronunciación", "Fluidez", "Comprensión", etc.
    """
    __tablename__ = "rubric_criteria"

    id = Column(Integer, primary_key=True)
    rubric_template_id = Column(Integer, ForeignKey("rubric_templates.id"), nullable=False)
    name = Column(String, nullable=False)  # Ej: "Pronunciación"
    description = Column(Text, nullable=True)
    max_points = Column(Integer, nullable=False, default=25)  # Puntuación máxima para este criterio
    order = Column(Integer, nullable=False, default=0)  # Orden de visualización
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow)
    is_deleted = Column(Boolean, default=False)

    template = relationship("RubricTemplate", back_populates="criteria")
    levels = relationship("RubricLevel", back_populates="criteria", cascade="all, delete-orphan")


class RubricLevel(Base):
    """
    Niveles de logro para un criterio.
    Ej para "Pronunciación": "Excelente (25pts)", "Bueno (20pts)", "Aceptable (15pts)", "Insuficiente (0pts)"
    """
    __tablename__ = "rubric_levels"

    id = Column(Integer, primary_key=True)
    rubric_criteria_id = Column(Integer, ForeignKey("rubric_criteria.id"), nullable=False)
    name = Column(String, nullable=False)  # Ej: "Excelente"
    description = Column(Text, nullable=True)  # Descripción detallada del nivel
    points = Column(Integer, nullable=False)  # Puntos asignados a este nivel
    order = Column(Integer, nullable=False, default=0)  # Orden descendente por puntos
    created_at = Column(DateTime(timezone=True), default=utcnow)
    is_deleted = Column(Boolean, default=False)

    criteria = relationship("RubricCriteria", back_populates="levels")


class Evaluation(Base):
    """
    Evaluación de una entrega por parte del terapeuta.
    Contiene las puntuaciones de cada criterio de la rúbrica.
    """
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False, unique=True)
    rubric_template_id = Column(Integer, ForeignKey("rubric_templates.id"), nullable=False)
    therapist_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    total_score = Column(Integer, nullable=False)  # Suma total de puntos
    notes = Column(Text, nullable=True)  # Notas generales del terapeuta
    is_locked = Column(Boolean, default=False)  # Bloquear edición después de guardar
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow)
    is_deleted = Column(Boolean, default=False)

    submission = relationship("Submission")
    rubric_template = relationship("RubricTemplate")
    criterion_scores = relationship("EvaluationCriterionScore", back_populates="evaluation", cascade="all, delete-orphan")


class EvaluationCriterionScore(Base):
    """
    Puntuación asignada a un criterio específico en una evaluación.
    """
    __tablename__ = "evaluation_criterion_scores"

    id = Column(Integer, primary_key=True)
    evaluation_id = Column(Integer, ForeignKey("evaluations.id"), nullable=False)
    rubric_criteria_id = Column(Integer, ForeignKey("rubric_criteria.id"), nullable=False)
    rubric_level_id = Column(Integer, ForeignKey("rubric_levels.id"), nullable=False)
    points_awarded = Column(Integer, nullable=False)  # Puntos reales asignados
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow)

    evaluation = relationship("Evaluation", back_populates="criterion_scores")
    criteria = relationship("RubricCriteria")
    level = relationship("RubricLevel")


class ExerciseWeighting(Base):
    """
    Ponderación/peso de cada ejercicio en el progreso general del estudiante en un curso.
    Esto permite al terapeuta definir qué ejercicios tienen más importancia.
    """
    __tablename__ = "exercise_weightings"

    id = Column(Integer, primary_key=True)
    course_exercise_id = Column(Integer, ForeignKey("course_exercises.id"), nullable=False, unique=True)
    therapist_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    weight = Column(Integer, nullable=False, default=1)  # Peso relativo (ej: 1, 2, 3)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow)

    course_exercise = relationship("CourseExercise")


class ExerciseFolder(Base):
    """
    Carpeta para organizar ejercicios del terapeuta.
    """
    __tablename__ = "exercise_folders"

    id = Column(Integer, primary_key=True)
    therapist_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    color = Column(String, nullable=True)  # Código de color hex para UI
    created_at = Column(DateTime(timezone=True), default=utcnow)
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    exercises = relationship("Exercise", back_populates="folder")


class CourseGroup(Base):
    """
    Grupo/carpeta para organizar cursos (tanto para terapeutas como estudiantes).
    """
    __tablename__ = "course_groups"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    color = Column(String, nullable=True)  # Código de color hex para UI
    created_at = Column(DateTime(timezone=True), default=utcnow)
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    assignments = relationship("CourseGroupAssignment", back_populates="group")


class CourseGroupAssignment(Base):
    """
    Asignación de un curso a un grupo (muchos a muchos).
    """
    __tablename__ = "course_group_assignments"

    id = Column(Integer, primary_key=True)
    course_group_id = Column(Integer, ForeignKey("course_groups.id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    group = relationship("CourseGroup", back_populates="assignments")
    course = relationship("Course")

    __table_args__ = (
        UniqueConstraint("course_group_id", "course_id", name="uniq_course_group_assignment"),
    )


class Profile(Base):
    """
    Perfil de estudiante para personalización de ejercicios con IA.
    Contiene características del estudiante que se envían a OpenAI para generar ejercicios adaptados.
    """
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True)
    therapist_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)  # Nombre del perfil (ej: "Niños con dislexia")
    description = Column(Text, nullable=False)  # Descripción detallada para IA
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow)
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    therapist = relationship("User")
