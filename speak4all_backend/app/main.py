from fastapi import FastAPI
from .routers import (
    auth, courses, exercises, submissions, course_exercises, 
    observations, course_students, course_groups, exercise_folders,
    websocket, users, rubrics, evaluations, progress, profiles, categories
)
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from fastapi.staticfiles import StaticFiles
import logging
from .config import settings

# Configurar logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Directorio de media restringido
MEDIA_DIR = Path.cwd() / "media"
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="Speak4All API",
    description="API para plataforma de terapia del habla",
    version="1.0.0"
)

# CORS con configuración desde variables de entorno
origins = [origin.strip() for origin in settings.cors_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info(f"CORS configurado para: {origins}")

# Montar solo la carpeta media (no todo el proyecto)
app.mount(
    "/media",
    StaticFiles(directory=MEDIA_DIR),
    name="media",
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(users.router)
app.include_router(courses.router, prefix="/courses", tags=["courses"])
app.include_router(exercises.router, prefix="/exercises", tags=["exercises"])
app.include_router(course_exercises.router, prefix="/course-exercises", tags=["course-exercises"])
app.include_router(submissions.router, prefix="/submissions", tags=["submissions"])
app.include_router(observations.router, prefix="/observations", tags=["observations"])
app.include_router(course_students.router, prefix="/course-students", tags=["course-students"])
app.include_router(course_groups.router, prefix="/course-groups", tags=["course-groups"])
app.include_router(exercise_folders.router, prefix="/exercise-folders", tags=["exercise-folders"])
app.include_router(rubrics.router)
app.include_router(evaluations.router)
app.include_router(progress.router)
app.include_router(profiles.router)
app.include_router(categories.router)

app.include_router(websocket.router, tags=["websocket"])

# Endpoint de healthcheck para Docker y monitoreo
@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"message": "Speak4All backend OK"}