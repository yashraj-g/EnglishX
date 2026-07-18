"""AWS S3 service for storing user audio recordings.

Each practice turn's audio is uploaded to S3 as a private object.
The key format is: audio/{user_id}/{session_id}/turn_{turn_index}.webm

Presigned GET URLs (1-hour TTL) are generated on-demand by ms1-core-api,
so the bucket can remain fully private — no public access needed.

Upload runs in a thread-pool executor so it never blocks the async turn pipeline.
If AWS is not configured, all methods gracefully return None/False.
"""
import asyncio
import base64
import logging
from functools import partial

from app.config import settings

logger = logging.getLogger(__name__)


def _is_configured() -> bool:
    """Return True if all required AWS settings are present."""
    return bool(
        settings.aws_s3_bucket
        and settings.aws_access_key_id
        and settings.aws_secret_access_key
        and settings.aws_s3_bucket != "your-englishx-audio-bucket"
    )


def _get_s3_client():
    """Create a boto3 S3 client. Imported lazily to avoid import errors when boto3 is absent."""
    try:
        import boto3  # type: ignore
        return boto3.client(
            "s3",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )
    except ImportError:
        logger.warning("boto3 not installed — S3 audio storage disabled")
        return None


def _sync_upload(audio_bytes: bytes, s3_key: str) -> bool:
    """Synchronous S3 put — runs in thread pool."""
    client = _get_s3_client()
    if client is None:
        return False
    try:
        client.put_object(
            Bucket=settings.aws_s3_bucket,
            Key=s3_key,
            Body=audio_bytes,
            ContentType="audio/webm",
            # Server-side encryption at rest (free, no extra cost)
            ServerSideEncryption="AES256",
        )
        logger.info("S3 upload succeeded: %s (%d bytes)", s3_key, len(audio_bytes))
        return True
    except Exception as e:
        logger.error("S3 upload failed for key %s: %s", s3_key, e)
        return False


class S3Service:
    """Async wrapper around boto3 S3 upload for audio recordings."""

    def make_key(self, user_id: str, session_id: str, turn_index: int) -> str:
        """Build a deterministic S3 object key for a turn recording."""
        safe_user = user_id.replace("/", "_") if user_id else "anonymous"
        return f"audio/{safe_user}/{session_id}/turn_{turn_index:04d}.webm"

    async def upload_audio(
        self,
        audio_base64: str,
        session_id: str,
        turn_index: int,
        user_id: str | None = None,
    ) -> str | None:
        """Upload base64-encoded WebM audio to S3.

        Returns the S3 object key on success, None if storage is not configured
        or if the upload fails (failure is logged but does NOT raise — audio
        storage is best-effort and must never break the conversation flow).
        """
        if not _is_configured():
            return None

        try:
            audio_bytes = base64.b64decode(audio_base64)
        except Exception as e:
            logger.error("Failed to decode audio_base64 for S3 upload: %s", e)
            return None

        s3_key = self.make_key(user_id or "anonymous", session_id, turn_index)

        loop = asyncio.get_event_loop()
        success = await loop.run_in_executor(
            None, partial(_sync_upload, audio_bytes, s3_key)
        )

        return s3_key if success else None


s3_service = S3Service()
