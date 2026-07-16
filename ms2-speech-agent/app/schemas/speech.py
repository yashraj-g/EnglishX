from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class SessionMode(str, Enum):
    FREE_TALK = "free_talk"
    HR_INTERVIEW = "hr_interview"
    PLACEMENT = "placement"


class TurnRequest(BaseModel):
    session_id: str
    audio_base64: Optional[str] = None
    text_input: Optional[str] = None
    mode: SessionMode = SessionMode.FREE_TALK
    learner_level: int = Field(default=2, ge=1, le=6)
    conversation_history: list[dict] = Field(default_factory=list)


class TurnResponse(BaseModel):
    user_transcript: str
    ai_reply: str
    word_confidences: list[dict] = Field(default_factory=list)


class AnalyzeRequest(BaseModel):
    session_id: str
    transcript: list[dict]
    mode: SessionMode = SessionMode.FREE_TALK
    learner_level: int = Field(default=2, ge=1, le=6)


class TTSRequest(BaseModel):
    text: str
    model: str = "aura-asteria-en"
