from fastapi import FastAPI
from .routers import auth, courses, exercises, submissions, course_exercises, observations, course_students
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from fastapi.staticfiles import StaticFiles

AUDIO_BASE_DIR = Path.cwd()

app = FastAPI(title="Speak4All API")

origins = [
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    "/media",
    StaticFiles(directory=AUDIO_BASE_DIR),
    name="media",
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(courses.router, prefix="/courses", tags=["courses"])
app.include_router(exercises.router, prefix="/exercises", tags=["exercises"])
app.include_router(course_exercises.router, prefix="/course-exercises", tags=["course-exercises"])
app.include_router(submissions.router, prefix="/submissions", tags=["submissions"])
app.include_router(observations.router, prefix="/observations", tags=["observations"])
app.include_router(course_students.router, prefix="/course-students", tags=["course-students"])


@app.get("/")
def root():
    return {"message": "Speak4All backend OK"}