"""Speech routes for ms2."""
import io
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas.speech import TurnRequest, TurnResponse, AnalyzeRequest, TTSRequest
from app.services.stt_service import stt_service
from app.services.tts_service import tts_service
from app.graphs.conversation_graph import conversation_graph, ConversationState
from app.graphs.feedback_pipeline import feedback_pipeline, FeedbackState
from app.graphs.placement_grader import grade_placement

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/speech", tags=["speech"])


@router.post("/turn", response_model=TurnResponse)
async def process_turn(request: TurnRequest):
    """Process a single conversation turn: STT → conversation graph → reply."""
    try:
        # Step 1: Transcribe audio (or use text fallback)
        if request.audio_base64:
            stt_result = await stt_service.transcribe_audio(request.audio_base64)
        elif request.text_input:
            stt_result = await stt_service.transcribe_text_fallback(request.text_input)
        else:
            raise HTTPException(status_code=400, detail="Either audio_base64 or text_input is required")

        user_transcript = stt_result["transcript"]
        word_confidences = stt_result.get("words", [])

        if not user_transcript.strip():
            raise HTTPException(status_code=400, detail="No speech detected in audio")

        # Step 2: Run conversation graph
        state: ConversationState = {
            "mode": request.mode.value,
            "learner_level": request.learner_level,
            "conversation_history": request.conversation_history,
            "user_transcript": user_transcript,
            "ai_reply": "",
            "word_confidences": word_confidences,
        }

        result = conversation_graph.invoke(state)

        return TurnResponse(
            user_transcript=user_transcript,
            ai_reply=result["ai_reply"],
            word_confidences=word_confidences,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Turn processing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Turn processing failed: {str(e)}")


@router.post("/analyze")
async def analyze_session(request: AnalyzeRequest):
    """Analyze a completed session transcript and return 3-dimension feedback."""
    try:
        # Collect word confidences from all turns
        all_word_confidences = []
        for turn in request.transcript:
            if turn.get("word_confidences"):
                all_word_confidences.extend(turn["word_confidences"])

        state: FeedbackState = {
            "transcript": request.transcript,
            "word_confidences": all_word_confidences,
            "learner_level": request.learner_level,
            "pronunciation_result": {},
            "vocabulary_result": {},
            "grammar_result": {},
            "aggregated_report": {},
        }

        result = feedback_pipeline.invoke(state)
        report = result.get("aggregated_report", {})

        return {
            "pronunciationScore": report.get("pronunciation", {}).get("score", 50),
            "vocabularyScore": report.get("vocabulary", {}).get("score", 50),
            "grammarScore": report.get("grammar", {}).get("score", 50),
            "overallScore": report.get("overall_score", 50),
            "pronunciationDetails": report.get("pronunciation", {}),
            "vocabularyDetails": report.get("vocabulary", {}),
            "grammarDetails": report.get("grammar", {}),
            "strengths": report.get("strengths", []),
            "encouragement": report.get("encouragement", ""),
        }

    except Exception as e:
        logger.error(f"Session analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/placement")
async def run_placement(request: AnalyzeRequest):
    """Analyze a placement conversation and return starting levels."""
    try:
        all_word_confidences = []
        for turn in request.transcript:
            if turn.get("word_confidences"):
                all_word_confidences.extend(turn["word_confidences"])

        result = await grade_placement(request.transcript, all_word_confidences)
        return result

    except Exception as e:
        logger.error(f"Placement grading failed: {e}")
        raise HTTPException(status_code=500, detail=f"Placement failed: {str(e)}")


@router.post("/tts")
async def text_to_speech(request: TTSRequest):
    """Convert AI reply text to speech using Deepgram Aura TTS.

    Returns MP3 audio bytes as an audio/mpeg StreamingResponse.
    The frontend fetches this endpoint right after receiving an AI reply
    and plays the audio through the Web Audio API.
    """
    try:
        if not request.text or not request.text.strip():
            raise HTTPException(status_code=400, detail="Text is required")

        audio_bytes = await tts_service.synthesize(request.text, request.model)

        if not audio_bytes:
            # Deepgram not configured — return 204 No Content so the frontend
            # can gracefully skip playback without throwing an error.
            from fastapi.responses import Response
            return Response(status_code=204)

        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/mpeg",
            headers={
                "Content-Length": str(len(audio_bytes)),
                "Cache-Control": "no-cache",
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TTS failed: {e}")
        raise HTTPException(status_code=500, detail=f"TTS failed: {str(e)}")


@router.get("/tts")
async def text_to_speech_get(text: str, model: str = "aura-asteria-en"):
    """Convert AI reply text to speech using Deepgram Aura TTS via GET.

    Returns MP3 audio bytes as an audio/mpeg StreamingResponse.
    The frontend can set this URL directly as an Audio source to enable fast streaming.
    """
    try:
        if not text or not text.strip():
            raise HTTPException(status_code=400, detail="Text is required")

        audio_bytes = await tts_service.synthesize(text, model)

        if not audio_bytes:
            from fastapi.responses import Response
            return Response(status_code=204)

        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/mpeg",
            headers={
                "Content-Length": str(len(audio_bytes)),
                "Cache-Control": "no-cache",
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TTS failed: {e}")
        raise HTTPException(status_code=500, detail=f"TTS failed: {str(e)}")
