from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    port: int = 8000
    google_api_key: str = ""
    deepgram_api_key: str = ""
    ms1_base_url: str = "http://localhost:3001"
    otel_exporter_otlp_endpoint: str = "http://localhost:4318"
    otel_service_name: str = "ms2-speech-agent"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
