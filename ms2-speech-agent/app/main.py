"""EnglishX ms2-speech-agent — FastAPI + LangGraph service."""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes.speech import router as speech_router
from app.routes.health import router as health_router
from app.otel import init_otel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="EnglishX Speech Agent",
    description="Voice AI English Speaking Coach — Speech-to-Text, Conversation, and Feedback Pipeline",
    version="1.0.0",
    docs_url="/speech/docs",
    redoc_url="/speech/redoc",
)

init_otel(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(speech_router)


@app.on_event("startup")
async def startup_event():
    logger.info(f"ms2-speech-agent starting on port {settings.port}")
    if not settings.google_api_key or settings.google_api_key == "your-gemini-api-key":
        logger.warning("⚠️  GOOGLE_API_KEY not set — using mock LLM responses")
    if not settings.deepgram_api_key or settings.deepgram_api_key == "your-deepgram-api-key":
        logger.warning("⚠️  DEEPGRAM_API_KEY not set — using mock STT transcripts")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.port, reload=True)
