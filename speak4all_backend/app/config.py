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

    # === Audio ===
    audio_rate: int = 44100
    bitrate: str = "192k"

    # === CORS ===
    cors_origins: str = "http://localhost:3000"

    # === File Upload Limits ===
    max_upload_size_mb: int = 10
    allowed_audio_types: str = "audio/mpeg,audio/mp3,audio/wav,audio/webm,audio/ogg"

    # === Logging ===
    log_level: str = "INFO"

    # === Configuración general ===
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

settings = Settings()
