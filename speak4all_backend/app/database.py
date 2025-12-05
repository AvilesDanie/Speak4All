from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import QueuePool
from .config import settings

# Aumentar el pool size y configurar mejor el comportamiento
engine = create_engine(
    settings.database_url, 
    echo=False, 
    future=True,
    poolclass=QueuePool,
    pool_size=20,  # Aumentado de 5 a 20
    max_overflow=40,  # Aumentado de 10 a 40
    pool_pre_ping=True,  # Verificar conexiones antes de usar
    pool_recycle=3600,  # Reciclar conexiones cada hora
    connect_args={"connect_timeout": 10}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependencia para inyectar el DB en los endpoints
def get_db():
    from fastapi import Depends
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
