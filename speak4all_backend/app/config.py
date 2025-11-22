# app/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # === Database & Auth ===
    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"

    openai_api_key: str
    openai_model: str = "gpt-4o-mini"
    openai_tts_model: str = "gpt-4o-mini-tts"
    tts_voice_name: str = "coral"

    # === Opcionales / Audio ===
    audio_rate: int = 44100
    bitrate: str = "192k"

    # === Configuración general ===
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

settings = Settings()
