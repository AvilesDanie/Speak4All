from datetime import datetime
from typing import Optional, Generic, TypeVar
from pydantic import BaseModel, ConfigDict, Field
from .models import UserRole, JoinRequestStatus, SubmissionStatus  


# ==== PAGINATION ====

T = TypeVar('T')

class PaginationParams(BaseModel):
    """Parámetros de paginación"""
    page: int = Field(1, ge=1, description="Número de página (inicia en 1)")
    page_size: int = Field(10, ge=1, le=100, description="Elementos por página (máx 100)")


class PaginatedResponse(BaseModel, Generic[T]):
    """Respuesta paginada genérica"""
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int


# ==== TOKEN ====

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ==== USER ====

class UserBase(BaseModel):
    email: str
    full_name: str
    role: UserRole


class UserOut(UserBase):
    id: int
    created_at: datetime
    avatar_path: Optional[str] = None
    has_password: bool = False  # Indica si el usuario tiene contraseña configurada

    model_config = ConfigDict(from_attributes=True)


# ==== AUTH ====

class GoogleLoginRequest(BaseModel):
    """
    Soporta dos métodos:
    1. id_token (recomendado): token JWT de Google para validación
    2. google_sub + email + full_name (legacy, menos seguro)
    Nota: role solo es obligatorio cuando se crea un nuevo usuario.
    """
    id_token: str | None = None
    google_sub: str | None = None
    email: str | None = None
    full_name: str | None = None
    role: UserRole | None = None
    password: str | None = None  # Contraseña opcional para usuarios que quieren acceso sin Google OAuth


class RegisterRequest(BaseModel):
    email: str
    full_name: str
    role: UserRole
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    token: Token
    user: UserOut


# ==== COURSES ====

class CourseCreate(BaseModel):
    name: str
    description: Optional[str] = None


class CourseOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    join_code: str
    therapist_id: int

    model_config = ConfigDict(from_attributes=True)


class JoinCourseRequest(BaseModel):
    join_code: str


class CourseJoinRequestOut(BaseModel):
    id: int
    course_id: int
    student_id: int
    status: JoinRequestStatus
    created_at: datetime
    student_full_name: Optional[str] = None
    student_email: Optional[str] = None
    student_avatar_path: Optional[str] = None
    student_avatar_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)



# ==== JOIN REQUEST DECISION ====

class JoinRequestDecision(BaseModel):
    accept: bool  # True = aceptar, False = rechazar


# ==== COURSE STUDENT / PROGRESS ====

class CourseStudentOut(BaseModel):
    id: int
    course_id: int
    student_id: int
    joined_at: datetime
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class StudentProgressOut(BaseModel):
    course_student_id: int
    student_id: int
    student_name: str
    avatar_path: Optional[str] = None
    completed_exercises: int
    total_exercises: int
    last_submission_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)




# ==== EXERCISES ====

class ExerciseGenerateRequest(BaseModel):
    prompt: str
    profile_id: int | None = None  # Perfil opcional para personalizar IA


class ExerciseGenerateResponse(BaseModel):
    # texto limpio (sin [REP]) para mostrar
    text: str
    # texto marcado (con [REP]) que el frontend puede guardar oculto
    marked_text: str


class ExerciseCreateRequest(BaseModel):
    name: str
    prompt: str  # Prompt manual obligatorio
    text: str                  # texto limpio (lo que ve el usuario)
    marked_text: str | None = None  # si viene, se usa éste para TTS
    folder_id: int | None = None  # carpeta donde guardar el ejercicio
    profile_id: int | None = None  # Perfil opcional seleccionado al generar


class ExerciseOut(BaseModel):
    id: int
    name: str
    prompt: str | None = None
    text: str
    audio_path: str
    created_at: datetime
    folder_id: int | None = None

    model_config = ConfigDict(from_attributes=True)




# ==== EXERCISE CATEGORY ====

class ExerciseCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = None


class ExerciseCategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


class ExerciseCategoryOut(BaseModel):
    id: int
    therapist_id: int
    name: str
    description: Optional[str] = None
    color: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==== COURSE EXERCISES ====

from datetime import datetime
from typing import Optional

class CourseExerciseCreate(BaseModel):
    course_id: int
    exercise_id: int
    category_id: Optional[int] = None
    due_date: Optional[datetime] = None


class CourseExerciseOut(BaseModel):
    id: int
    course_id: int
    exercise_id: int
    category_id: Optional[int] = None
    published_at: datetime
    due_date: Optional[datetime]
    is_deleted: bool
    # opcional: incluir información del ejercicio y categoría
    exercise: Optional[ExerciseOut] = None
    category: Optional[ExerciseCategoryOut] = None

    model_config = ConfigDict(from_attributes=True)






# ==== SUBMISSIONS (ENTREGAS) ====

class SubmissionOut(BaseModel):
    id: int
    student_id: int
    course_exercise_id: int
    status: SubmissionStatus
    media_path: str  # Ruta de foto o video (obligatorio)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)




# ==== OBSERVATIONS ====

class ObservationCreate(BaseModel):
    submission_id: int
    text: str


class ObservationUpdate(BaseModel):
    text: str


class ObservationOut(BaseModel):
    id: int
    submission_id: int
    therapist_id: int
    therapist_name: str | None = None
    text: str
    created_at: datetime
    updated_at: datetime
    is_deleted: bool

    model_config = ConfigDict(from_attributes=True)



# ==== PROGRESS / COURSE STUDENTS ====

class StudentProgressSummary(BaseModel):
    student_id: int
    full_name: str
    email: str
    avatar_path: Optional[str] = None
    total_exercises: int
    done_exercises: int
    last_submission_at: Optional[datetime] = None


class StudentExerciseStatus(BaseModel):
    course_exercise_id: int
    exercise_name: str
    due_date: Optional[datetime]
    status: SubmissionStatus
    submitted_at: Optional[datetime] = None
    has_media: bool = False  # Indica si tiene evidencia (foto/video)
    submission_id: Optional[int] = None  # ID de la submission si existe

    model_config = ConfigDict(from_attributes=True)




# ---- SUBMISSIONS: vistas para terapeuta ----

class SubmissionListItem(BaseModel):
    """
    Una fila del listado por ejercicio para el terapeuta.
    Si submission_id es None -> el estudiante NO ha entregado.
    """
    student_id: int
    full_name: str
    email: str

    submission_id: Optional[int] = None
    status: Optional[SubmissionStatus] = None  # None = no entregó
    has_media: bool = False  # Indica si tiene evidencia (foto/video)
    media_path: Optional[str] = None
    submitted_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class SubmissionDetailOut(BaseModel):
    """
    Detalle de una entrega concreta (para un estudiante + ejercicio).
    """
    submission: SubmissionOut
    student: UserOut

    model_config = ConfigDict(from_attributes=True)


# ==== EXERCISE FOLDERS ====

class ExerciseFolderCreate(BaseModel):
    name: str
    color: Optional[str] = None


class ExerciseFolderUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class ExerciseFolderOut(BaseModel):
    id: int
    therapist_id: int
    name: str
    color: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==== COURSE GROUPS ====

class CourseGroupCreate(BaseModel):
    name: str
    color: Optional[str] = None


class CourseGroupUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class CourseGroupOut(BaseModel):
    id: int
    user_id: int
    name: str
    color: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CourseGroupAssignmentCreate(BaseModel):
    course_id: int


class CourseGroupAssignmentOut(BaseModel):
    id: int
    course_group_id: int
    course_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==== USER PROFILE ====

class UserProfileUpdate(BaseModel):
    """Schema para actualizar perfil de usuario"""
    full_name: Optional[str] = None
    email: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    """Schema para cambiar contraseña"""
    current_password: Optional[str] = None  # Opcional para usuarios sin contraseña previa
    new_password: str


# ==== RUBRIC (RÚBRICA) ====

class RubricLevelCreate(BaseModel):
    name: str
    description: Optional[str] = None
    points: int = Field(ge=0)
    order: int = 0


class RubricLevelUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    points: Optional[int] = Field(None, ge=0)
    order: Optional[int] = None


class RubricLevelOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    points: int
    order: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RubricCriteriaCreate(BaseModel):
    name: str
    description: Optional[str] = None
    max_points: int = Field(default=25, ge=1)
    order: int = 0
    levels: list[RubricLevelCreate] = []


class RubricCriteriaUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    max_points: Optional[int] = Field(None, ge=1)
    order: Optional[int] = None


class RubricCriteriaOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    max_points: int
    order: int
    created_at: datetime
    levels: list[RubricLevelOut] = []

    model_config = ConfigDict(from_attributes=True)


class RubricTemplateCreate(BaseModel):
    course_exercise_id: int
    max_score: int = Field(default=100, ge=1)
    criteria: list[RubricCriteriaCreate] = []


class RubricTemplateUpdate(BaseModel):
    max_score: Optional[int] = Field(None, ge=1)


class RubricTemplateOut(BaseModel):
    id: int
    course_exercise_id: int
    therapist_id: int
    max_score: int
    created_at: datetime
    updated_at: datetime
    criteria: list[RubricCriteriaOut] = []

    model_config = ConfigDict(from_attributes=True)


# ==== EVALUATION (EVALUACIÓN) ====

class EvaluationCriterionScoreCreate(BaseModel):
    rubric_criteria_id: int
    rubric_level_id: int
    points_awarded: int = Field(ge=0)


class EvaluationCriterionScoreOut(BaseModel):
    id: int
    rubric_criteria_id: int
    rubric_level_id: int
    points_awarded: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EvaluationCreate(BaseModel):
    submission_id: int
    rubric_template_id: int
    criterion_scores: list[EvaluationCriterionScoreCreate]
    notes: Optional[str] = None


class EvaluationUpdate(BaseModel):
    criterion_scores: Optional[list[EvaluationCriterionScoreCreate]] = None
    notes: Optional[str] = None


class EvaluationOut(BaseModel):
    id: int
    submission_id: int
    rubric_template_id: int
    therapist_id: int
    total_score: int
    notes: Optional[str] = None
    is_locked: bool = False
    created_at: datetime
    updated_at: datetime
    criterion_scores: list[EvaluationCriterionScoreOut] = []

    model_config = ConfigDict(from_attributes=True)


# ==== EXERCISE WEIGHTING (PONDERACIÓN) ====

class ExerciseWeightingCreate(BaseModel):
    course_exercise_id: int
    weight: int = Field(default=1, ge=1)


class ExerciseWeightingUpdate(BaseModel):
    weight: int = Field(ge=1)


class ExerciseWeightingOut(BaseModel):
    id: int
    course_exercise_id: int
    therapist_id: int
    weight: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==== STUDENT PROGRESS WITH EVALUATION ====

class ExerciseScoreProgress(BaseModel):
    course_exercise_id: int
    exercise_name: str
    score: Optional[float] = None
    max_score: Optional[float] = None
    weight: Optional[int] = None
    evaluated: bool = False
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    category_color: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class StudentProgressWithEvaluation(BaseModel):
    """Progreso de un estudiante considerando evaluaciones y ponderaciones"""
    student_id: int
    full_name: str
    email: str
    avatar_path: Optional[str] = None
    weighted_score: float  # Promedio ponderado de calificaciones
    total_exercises: int
    evaluated_exercises: int
    evaluations_summary: Optional[str] = None  # Resumen o descripción del progreso
    exercise_scores: list[ExerciseScoreProgress] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class SubmissionWithEvaluation(BaseModel):
    """Entrega con su evaluación y observaciones"""
    submission: SubmissionOut
    student: UserOut
    evaluation: Optional[EvaluationOut] = None
    observations: list[ObservationOut] = []
    rubric: Optional[RubricTemplateOut] = None

    model_config = ConfigDict(from_attributes=True)


# ==== PROFILE (PERFILES DE ESTUDIANTE) ====

class ProfileCreate(BaseModel):
    name: str
    description: str


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ProfileOut(BaseModel):
    id: int
    therapist_id: int
    name: str
    description: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
