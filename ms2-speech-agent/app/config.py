from pydantic_settings import BaseSettings, SettingsConfigDict  # type: ignore
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    port: int = 8000
    google_api_key: str = ""
    deepgram_api_key: str = ""
    ms1_base_url: str = "http://localhost:3001"

    # OpenTelemetry — set OTEL_EXPORTER_OTLP_ENDPOINT to Grafana Cloud gateway
    otel_exporter_otlp_endpoint: str = "http://localhost:4318"
    # Optional: "Authorization=Basic <base64(instanceID:apiToken)>"
    otel_exporter_otlp_headers: str = ""
    otel_service_name: str = "ms2-speech-agent"


settings = Settings()
