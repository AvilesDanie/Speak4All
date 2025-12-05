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

    model_config = ConfigDict(from_attributes=True)



class CourseJoinRequestOut(BaseModel):
    id: int
    course_id: int
    student_id: int
    status: JoinRequestStatus
    created_at: datetime

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
    completed_exercises: int
    total_exercises: int
    last_submission_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)




# ==== EXERCISES ====

class ExerciseGenerateRequest(BaseModel):
    prompt: str


class ExerciseGenerateResponse(BaseModel):
    # texto limpio (sin [REP]) para mostrar
    text: str
    # texto marcado (con [REP]) que el frontend puede guardar oculto
    marked_text: str


class ExerciseCreateRequest(BaseModel):
    name: str
    prompt: str | None = None
    text: str                  # texto limpio (lo que ve el usuario)
    marked_text: str | None = None  # si viene, se usa éste para TTS
    folder_id: int | None = None  # carpeta donde guardar el ejercicio


class ExerciseOut(BaseModel):
    id: int
    name: str
    prompt: str | None = None
    text: str
    audio_path: str
    created_at: datetime
    folder_id: int | None = None

    model_config = ConfigDict(from_attributes=True)




# ==== COURSE EXERCISES ====

from datetime import datetime
from typing import Optional

class CourseExerciseCreate(BaseModel):
    course_id: int
    exercise_id: int
    due_date: Optional[datetime] = None


class CourseExerciseOut(BaseModel):
    id: int
    course_id: int
    exercise_id: int
    published_at: datetime
    due_date: Optional[datetime]
    is_deleted: bool
    # opcional: incluir información del ejercicio
    exercise: Optional[ExerciseOut] = None

    model_config = ConfigDict(from_attributes=True)






# ==== SUBMISSIONS (ENTREGAS) ====

class SubmissionOut(BaseModel):
    id: int
    student_id: int
    course_exercise_id: int
    status: SubmissionStatus
    audio_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SubmissionStatusUpdate(BaseModel):
    done: bool



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
    total_exercises: int
    done_exercises: int
    last_submission_at: Optional[datetime] = None


class StudentExerciseStatus(BaseModel):
    course_exercise_id: int
    exercise_name: str
    due_date: Optional[datetime]
    status: SubmissionStatus
    submitted_at: Optional[datetime] = None
    has_audio: bool = False

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
    has_audio: bool = False
    audio_path: Optional[str] = None
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
