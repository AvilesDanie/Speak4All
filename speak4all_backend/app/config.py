# app/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # === Database & Auth ===
    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"

    # === Google OAuth ===
    google_client_id: str | None = None

    # === OpenAI ===
    openai_api_key: str
    openai_model: str = "gpt-4o-mini"
    openai_tts_model: str = "gpt-4o-mini-tts"
    tts_voice_name: str = "coral"

    # === Google Cloud Storage ===
    google_application_credentials: str | None = None
    gcp_bucket_name: str

    # === Audio ===
    audio_rate: int = 44100
    bitrate: str = "192k"

    # === CORS ===
    cors_origins: str = "http://localhost:3000"

    # === File Upload Limits ===
    max_upload_size_mb: int = 500
    allowed_media_types: str = "image/jpeg,image/jpg,image/png,image/webp,video/mp4,video/webm,video/quicktime"

    # === Logging ===
    log_level: str = "INFO"

    # === Configuración general ===
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

settings = Settings()
