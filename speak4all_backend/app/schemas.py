from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from .models import UserRole, JoinRequestStatus, SubmissionStatus  


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
    Por ahora simplificamos: el frontend nos manda directamente
    google_sub, email y nombre. Luego puedes cambiar esto a id_token.
    """
    google_sub: str
    email: str
    full_name: str
    role: UserRole


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


class ExerciseOut(BaseModel):
    id: int
    name: str
    prompt: str | None = None
    text: str
    audio_path: str
    created_at: datetime

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

    model_config = ConfigDict(from_attributes=True)
