"""Text-to-Speech service using Deepgram Aura API."""
import logging
from deepgram import DeepgramClient, SpeakOptions

from app.config import settings

logger = logging.getLogger(__name__)

# Deepgram Aura voice — natural, friendly female voice ideal for English coaching
_DEFAULT_MODEL = "aura-asteria-en"


class TTSService:
    """Text-to-Speech service using Deepgram Aura."""

    def __init__(self):
        self._client = None

    @property
    def client(self):
        if (
            self._client is None
            and settings.deepgram_api_key
            and settings.deepgram_api_key != "your-deepgram-api-key"
        ):
            self._client = DeepgramClient(settings.deepgram_api_key)
        return self._client

    async def synthesize(self, text: str, model: str = _DEFAULT_MODEL) -> bytes:
        """Convert text to speech and return raw MP3 audio bytes.

        Uses Deepgram Aura REST TTS via the synchronous deepgram-sdk v3 client.
        Returns empty bytes if Deepgram is not configured.
        """
        if not self.client:
            logger.warning("Deepgram not configured — TTS will return empty audio")
            return b""

        if not text or not text.strip():
            return b""

        # Truncate very long responses to keep TTS latency reasonable
        if len(text) > 1000:
            text = text[:997] + "..."

        try:
            options = SpeakOptions(
                model=model,
                encoding="mp3",
            )

            # SpeakRESTResponse speak.rest is a blocking synchronous network call.
            # Running it via asyncio.to_thread prevents it from blocking the FastAPI event loop.
            import asyncio
            response = await asyncio.to_thread(
                self.client.speak.rest.v("1").stream_memory,
                {"text": text},
                options,
            )

            audio_bytes = response.stream_memory.read()
            logger.info(
                "TTS synthesized %d bytes for %d chars (model=%s)",
                len(audio_bytes),
                len(text),
                model,
            )
            return audio_bytes

        except Exception as e:
            logger.error(f"TTS synthesis failed: {e}")
            raise RuntimeError(f"Text-to-speech failed: {e}")


tts_service = TTSService()
