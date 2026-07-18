"""LangGraph Conversation Partner Graph.

Stateful conversation agent that adapts to the learner's level,
supports free talk and HR interview modes.

Filler-word awareness: when Deepgram detects many hesitations (um/uh),
the system prompt encourages the AI to slow down and give the learner
more breathing room, instead of peppering them with follow-up questions.
"""
import logging
from typing import TypedDict

from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END

from app.config import settings

logger = logging.getLogger(__name__)


class ConversationState(TypedDict):
    """State for the conversation partner graph."""
    mode: str
    learner_level: int
    conversation_history: list[dict]
    user_transcript: str
    ai_reply: str
    word_confidences: list[dict]
    filler_words: list[str]
    language_confidence: float


SYSTEM_PROMPTS = {
    "free_talk": """You are EnglishX, a friendly and patient AI English speaking coach. 
You are having a casual conversation with a learner whose English level is {level}/6 (where 1=beginner, 6=proficient).

Rules:
- Keep your responses SHORT (2-3 sentences max) to encourage the learner to speak more
- Adapt your vocabulary and sentence complexity to slightly above their level (stretch them gently)
- Ask follow-up questions to keep the conversation going
- Be warm, encouraging, and never judge mistakes
- Use everyday topics: hobbies, work, travel, food, movies, family, goals
- If they seem stuck, offer a simpler way to say what they might be trying to express
- NEVER correct their grammar during conversation — save it for the feedback report
- Respond naturally as a conversation partner, not as a teacher{filler_hint}""",

    "hr_interview": """You are EnglishX acting as an HR interviewer conducting a practice job interview.
The learner's English level is {level}/6 (where 1=beginner, 6=proficient).

Rules:
- Conduct a realistic but supportive HR interview
- Ask common interview questions: tell me about yourself, strengths/weaknesses, 
  why do you want this job, describe a challenge you overcame, where do you see yourself in 5 years
- Ask ONE question at a time and wait for their response
- Give brief, natural acknowledgments before moving to the next question
- Adapt question complexity to their level
- Be professional but warm — this is practice, not a real interview
- Keep your responses SHORT (1-2 sentences + the next question)
- NEVER correct their grammar during the interview{filler_hint}""",

    "placement": """You are EnglishX conducting a brief English level placement assessment.
Ask a mix of questions that test different complexity levels.

Rules:
- Start with simple questions (What's your name? Where are you from?)
- Gradually increase complexity (Tell me about your daily routine, Describe a memorable experience)
- Ask 5-6 questions total
- Keep your questions SHORT and clear
- Be warm and encouraging — this should feel like a friendly chat, not an exam
- After 5-6 exchanges, say 'Thank you! That's all for the placement. Let me analyze your speaking level.'"""
}

# Added to system prompt when the learner is using many filler words
_FILLER_HINT = """
- The learner is using many hesitation sounds (um, uh). Give them extra time by keeping your 
  response even shorter this turn — one sentence and one simple question. Do NOT pile on."""


def get_llm():
    """Get configured Gemini LLM instance."""
    if not settings.google_api_key or settings.google_api_key == "your-gemini-api-key":
        logger.warning("Gemini API key not configured — conversation will use mock responses")
        return None
    return ChatGoogleGenerativeAI(
        model="gemini-3.1-flash-lite",
        google_api_key=settings.google_api_key,
        temperature=0.7,
        max_output_tokens=200,
    )


def generate_reply(state: ConversationState) -> ConversationState:
    """Generate AI reply based on conversation context."""
    llm = get_llm()
    mode = state.get("mode", "free_talk")
    level = state.get("learner_level", 2)
    history = state.get("conversation_history", [])
    user_text = state.get("user_transcript", "")
    filler_words = state.get("filler_words", [])
    language_confidence = state.get("language_confidence", 1.0)

    # Determine if learner is struggling with fluency
    filler_count = len(filler_words)
    struggling_with_fluency = filler_count >= 3 or language_confidence < 0.70
    filler_hint = _FILLER_HINT if struggling_with_fluency else ""

    prompt_template = SYSTEM_PROMPTS.get(mode, SYSTEM_PROMPTS["free_talk"])
    system_prompt = prompt_template.format(level=level, filler_hint=filler_hint) if "{filler_hint}" in prompt_template else prompt_template.format(level=level)

    if not llm:
        mock_replies = [
            "That's really interesting! Can you tell me more about that?",
            "I see! What made you interested in that?",
            "That sounds great. How long have you been doing that?",
            "Wonderful! What's your favourite part about it?",
            "That's cool! Do you do this often?",
        ]
        turn_num = len(history) % len(mock_replies)
        state["ai_reply"] = mock_replies[turn_num]
        return state

    messages = [{"role": "system", "content": system_prompt}]

    for turn in history:
        role = "assistant" if turn.get("role") == "ai" else "user"
        messages.append({"role": role, "content": turn.get("content", "")})

    if user_text:
        messages.append({"role": "user", "content": user_text})

    try:
        response = llm.invoke(messages)
        state["ai_reply"] = response.content
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        state["ai_reply"] = "I'm sorry, I had a little hiccup. Could you say that again?"

    return state


def build_conversation_graph():
    """Build the LangGraph conversation partner graph."""
    graph = StateGraph(ConversationState)

    graph.add_node("generate_reply", generate_reply)
    graph.set_entry_point("generate_reply")
    graph.add_edge("generate_reply", END)

    return graph.compile()


conversation_graph = build_conversation_graph()
