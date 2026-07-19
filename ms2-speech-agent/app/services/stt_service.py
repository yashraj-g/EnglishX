"""Speech-to-Text service using Deepgram Nova-3 API.

Provides phoneme-level accuracy for Hindi-accented English learners:
- filler_words=True  : captures um / uh / hesitations as distinct tokens
- detect_language    : returns language-confidence score (lower = heavier accent)
- keyterms           : boosts phonetically confused word pairs common for Hindi speakers
"""
import base64
import logging
from deepgram import DeepgramClient, PrerecordedOptions

from app.config import settings

logger = logging.getLogger(__name__)

# Words Hindi-native speakers commonly confuse phonetically.
# Deepgram keyterm boosts recognition accuracy for these tokens (no weights supported).
_HINDI_SPEAKER_KEYTERMS = [
    "very",    # v/w confusion — "wery"
    "worry",
    "weather", # w/v — "veather"
    "whether",
    "think",   # th→t/d confusion
    "thought",
    "three",
    "through",
    "that",
    "this",
    "the",
    "them",
    "there",
    "these",
    "those",
    "then",
    "brother",
    "mother",
    "father",
    "right",   # r/l distinction
    "light",
    "rice",
    "lice",
]


class STTService:
    """Speech-to-Text service using Deepgram API."""

    def __init__(self):
        self._client = None

    @property
    def client(self):
        if self._client is None and settings.deepgram_api_key and settings.deepgram_api_key != "your-deepgram-api-key":
            self._client = DeepgramClient(settings.deepgram_api_key)
        return self._client

    async def transcribe_audio(self, audio_base64: str) -> dict:
        """Transcribe base64-encoded audio and return transcript with rich pronunciation data.

        Returns a dict with:
          - transcript: str
          - confidence: float
          - words: list[dict]  — per-word confidence + timing
          - filler_words: list[str]  — detected hesitations (um, uh, etc.)
          - filler_count: int
          - language_confidence: float  — how confidently Deepgram detected English
        """
        if not self.client:
            logger.warning("Deepgram not configured — returning mock transcript")
            return {
                "transcript": "This is a mock transcript because Deepgram is not configured.",
                "confidence": 0.95,
                "words": [
                    {"word": "this", "confidence": 0.99, "start": 0.0, "end": 0.2},
                    {"word": "is", "confidence": 0.98, "start": 0.2, "end": 0.3},
                    {"word": "a", "confidence": 0.97, "start": 0.3, "end": 0.4},
                    {"word": "mock", "confidence": 0.96, "start": 0.4, "end": 0.6},
                    {"word": "transcript", "confidence": 0.95, "start": 0.6, "end": 1.0},
                ],
                "filler_words": [],
                "filler_count": 0,
                "language_confidence": 1.0,
            }

        try:
            audio_bytes = base64.b64decode(audio_base64)

            options = PrerecordedOptions(
                model="nova-3",
                language="en",
                smart_format=True,
                punctuate=True,
                diarize=False,
                utterances=True,
                filler_words=True,        # Capture um/uh/hesitations as tokens
                detect_language=False,    # Forced English transcription
                keyterm=_HINDI_SPEAKER_KEYTERMS,  # Boost phonetic confusion pairs
            )

            source = {"buffer": audio_bytes, "mimetype": "audio/webm"}
            response = await self.client.listen.asyncrest.v("1").transcribe_file(source, options)

            result = response.to_dict()
            channel = result.get("results", {}).get("channels", [{}])[0]
            alternative = channel.get("alternatives", [{}])[0]

            transcript = alternative.get("transcript", "")
            confidence = alternative.get("confidence", 0.0)

            # Extract per-word data
            raw_words = alternative.get("words", [])
            words = []
            filler_words = []

            for w in raw_words:
                word_text = w.get("word", "")
                word_type = w.get("type", "word")  # "word" | "filler" | "punctuation"
                word_entry = {
                    "word": word_text,
                    "confidence": w.get("confidence", 0.0),
                    "start": w.get("start", 0.0),
                    "end": w.get("end", 0.0),
                    "type": word_type,
                }
                words.append(word_entry)
                if word_type == "filler":
                    filler_words.append(word_text)

            # Extract language confidence from detection metadata
            language_confidence = 1.0
            detected_languages = result.get("results", {}).get("channels", [{}])[0].get(
                "detected_language_info", []
            )
            if detected_languages:
                language_confidence = detected_languages[0].get("confidence", 1.0)

            logger.info(
                "STT: transcript=%d chars, words=%d, fillers=%d, lang_confidence=%.2f",
                len(transcript),
                len(words),
                len(filler_words),
                language_confidence,
            )

            return {
                "transcript": transcript,
                "confidence": confidence,
                "words": words,
                "filler_words": filler_words,
                "filler_count": len(filler_words),
                "language_confidence": language_confidence,
            }

        except Exception as e:
            logger.error(f"STT transcription failed: {e}")
            raise RuntimeError(f"Speech-to-text failed: {e}")

    async def transcribe_text_fallback(self, text: str) -> dict:
        """Fallback for text input (when mic is not available)."""
        words = text.split()
        return {
            "transcript": text,
            "confidence": 1.0,
            "words": [
                {"word": w, "confidence": 1.0, "start": i * 0.3, "end": (i + 1) * 0.3, "type": "word"}
                for i, w in enumerate(words)
            ],
            "filler_words": [],
            "filler_count": 0,
            "language_confidence": 1.0,
        }


stt_service = STTService()
