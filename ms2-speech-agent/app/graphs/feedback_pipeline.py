"""LangGraph Feedback Pipeline.

Three-node sequential analysis: pronunciation, vocabulary, grammar.
Aggregates into a structured feedback report.

Pronunciation node uses Deepgram's rich signal (filler words, language confidence,
per-word confidence) combined with phoneme-level LLM reasoning for Hindi speakers.
"""
import json
import logging
from typing import TypedDict

from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END

from app.config import settings
from app.services.scoring import score_to_level

logger = logging.getLogger(__name__)


class FeedbackState(TypedDict):
    """State for the feedback pipeline graph."""
    transcript: list[dict]
    word_confidences: list[dict]
    filler_words: list[str]
    filler_count: int
    language_confidence: float
    learner_level: int
    pronunciation_result: dict
    vocabulary_result: dict
    grammar_result: dict
    aggregated_report: dict


def get_llm():
    if not settings.google_api_key or settings.google_api_key == "your-gemini-api-key":
        return None
    return ChatGoogleGenerativeAI(
        model="gemini-3.1-flash-lite",
        google_api_key=settings.google_api_key,
        temperature=0.3,
        max_output_tokens=1500,
    )


def _extract_user_text(transcript: list[dict]) -> str:
    """Extract only the learner's spoken text from the transcript."""
    user_turns = [t.get("content", "") for t in transcript if t.get("role") == "user"]
    return " ".join(user_turns)


def analyze_pronunciation(state: FeedbackState) -> FeedbackState:
    """Analyze pronunciation using Deepgram signals and LLM phoneme reasoning.

    Uses three Deepgram-derived signals:
    1. word_confidences  — per-word confidence scores (low = likely mispronounced)
    2. filler_words      — detected hesitations (um, uh, etc.) from Deepgram filler_words=True
    3. language_confidence — overall speech clarity (lower = heavier accent, harder to understand)
    """
    llm = get_llm()
    user_text = _extract_user_text(state.get("transcript", []))
    word_confidences = state.get("word_confidences", [])
    filler_words = state.get("filler_words", [])
    filler_count = state.get("filler_count", 0)
    language_confidence = state.get("language_confidence", 1.0)

    if not llm:
        state["pronunciation_result"] = {
            "mispronounced_words": [
                {"word": "very", "likely_said": "wery", "phoneme_issue": "v→w substitution", "tip": "Place upper teeth on lower lip to make the 'v' sound"},
            ],
            "phoneme_issues": [
                {"phoneme_pair": "v/w", "example_word": "very", "correction": "Make the 'v' by touching upper teeth to lower lip"},
                {"phoneme_pair": "th/d or th/t", "example_word": "think → tink", "correction": "Place tongue tip between teeth for 'th'"},
            ],
            "filler_analysis": {
                "count": filler_count,
                "words_detected": filler_words,
                "assessment": "Moderate use of fillers. Practice pausing silently instead.",
            },
            "clarity_score": round(language_confidence * 100),
            "pace_assessment": "Good pace overall",
            "score": 45,
        }
        return state

    # Low-confidence words are likely mispronounced (threshold raised to 0.94 to capture subtle mistakes)
    # Only include content words (type == "word"), not fillers
    low_confidence_words = [
        w for w in word_confidences
        if w.get("confidence", 1.0) < 0.94 and w.get("type", "word") == "word"
    ]

    # Accent clarity: language_confidence < 0.80 = heavy accent causing recognition issues
    clarity_level = "clear" if language_confidence >= 0.85 else (
        "moderately accented" if language_confidence >= 0.70 else "heavily accented"
    )

    prompt = f"""You are a precise English pronunciation coach specializing in Hindi-native English learners.

Learner profile:
- English level: {state.get('learner_level', 2)}/6 (1=beginner, 6=proficient)
- Native language: Hindi
- Speech clarity: {clarity_level} (Deepgram language confidence: {language_confidence:.2f}/1.0)

The learner said: "{user_text}"

Words Deepgram struggled to recognize (likely mispronounced or forced-transcribed):
{json.dumps(low_confidence_words[:12], indent=2)}

Filler words Deepgram detected (actual hesitations): {filler_words}
Total filler count: {filler_count}

Common Hindi-speaker phoneme issues to check for:
- v/w confusion: "very" → "wery", "wine" → "vine"
- th→d or th→t: "think" → "tink", "that" → "dat", "three" → "tree"
- Retroflex consonants: strong t/d sounds instead of dental t/d
- Aspirated stops: extra breath on p/t/k at word starts
- r/l distinction: "rice"/"lice", "right"/"light"
- Missing word-final consonants: "and" → "an", "last" → "las"
- Vowel length: short vs. long vowels (bit/beat, pull/pool)

Respond in this EXACT JSON format (no markdown, no explanation):
{{
    "mispronounced_words": [
        {{
            "word": "the correct target word",
            "likely_said": "how the learner likely pronounced it",
            "phoneme_issue": "specific phoneme substitution e.g. th→d",
            "tip": "one clear actionable tip to fix it"
        }}
    ],
    "phoneme_issues": [
        {{
            "phoneme_pair": "v/w or th/d etc.",
            "example_word": "word showing the problem",
            "correction": "mouth position / technique to fix it"
        }}
    ],
    "filler_analysis": {{
        "count": {filler_count},
        "words_detected": {json.dumps(filler_words)},
        "assessment": "brief assessment of filler usage pattern and advice"
    }},
    "clarity_score": {round(language_confidence * 100)},
    "pace_assessment": "brief note on speaking pace based on word timings",
    "score": 50
}}

Score 0-100: 0-16=very poor, 17-33=poor, 34-50=fair, 51-67=good, 68-84=very good, 85-100=excellent.
Consider: word clarity, phoneme accuracy, filler frequency, language_confidence score.
Be specific — name the exact words mispronounced and the exact phoneme substitution.
Note: If a word has low confidence (like 'bought'), check if they might have made a grammar mistake like 'buyed' or said a phonetically skewed word like 'camputerr' instead of 'computer'."""

    try:
        response = llm.invoke(prompt)
        content = response.content.strip()
        # Strip markdown code fences if present
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        result = json.loads(content.strip())
        state["pronunciation_result"] = result
    except Exception as e:
        logger.error(f"Pronunciation analysis failed: {e}")
        state["pronunciation_result"] = {
            "mispronounced_words": [],
            "phoneme_issues": [],
            "filler_analysis": {"count": filler_count, "words_detected": filler_words, "assessment": "Unable to analyze"},
            "clarity_score": round(language_confidence * 100),
            "pace_assessment": "Unable to analyze",
            "score": 50,
        }

    return state


def analyze_vocabulary(state: FeedbackState) -> FeedbackState:
    """Analyze vocabulary — word variety, repetition, better alternatives."""
    llm = get_llm()
    user_text = _extract_user_text(state.get("transcript", []))

    if not llm:
        state["vocabulary_result"] = {
            "repeated_words": [
                {"word": "good", "count": 5, "alternatives": ["excellent", "wonderful", "great", "impressive"]},
            ],
            "better_alternatives": [
                {"used": "nice", "suggestion": "delightful", "context": "The weather is delightful today"},
            ],
            "word_variety_score": 0.6,
            "register_notes": "Good casual register. Try using more formal vocabulary for interviews.",
            "score": 50,
        }
        return state

    prompt = f"""Analyze the vocabulary usage of this English learner (Level {state.get('learner_level', 2)}/6).

Their spoken text: "{user_text}"

Respond in this EXACT JSON format:
{{
    "repeated_words": [
        {{"word": "overused word", "count": 3, "alternatives": ["better", "word", "choices"]}}
    ],
    "better_alternatives": [
        {{"used": "simple word they used", "suggestion": "better word", "context": "example sentence using the better word"}}
    ],
    "word_variety_score": 0.6,
    "register_notes": "brief note on formal/informal register appropriateness",
    "score": 50
}}

Score 0-100 where: 0-16=very limited, 17-33=basic, 34-50=adequate, 51-67=good variety, 68-84=rich, 85-100=exceptional.
Be specific: name the exact repeated words and give practical alternatives with example sentences.
Return ONLY valid JSON, no markdown."""

    try:
        response = llm.invoke(prompt)
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        result = json.loads(content.strip())
        state["vocabulary_result"] = result
    except Exception as e:
        logger.error(f"Vocabulary analysis failed: {e}")
        state["vocabulary_result"] = {
            "repeated_words": [],
            "better_alternatives": [],
            "word_variety_score": 0.5,
            "register_notes": "Unable to analyze",
            "score": 50,
        }

    return state


def analyze_grammar(state: FeedbackState) -> FeedbackState:
    """Analyze grammar — errors with corrections and underlying rules."""
    llm = get_llm()
    user_text = _extract_user_text(state.get("transcript", []))

    if not llm:
        state["grammar_result"] = {
            "errors": [
                {
                    "original": "I am working there since 2022",
                    "corrected": "I have been working there since 2022",
                    "rule": "Use present perfect continuous for ongoing duration with 'since'",
                    "category": "tense",
                },
            ],
            "error_categories": ["tense consistency", "articles"],
            "score": 42,
        }
        return state

    prompt = f"""Analyze the grammar of this English learner (Level {state.get('learner_level', 2)}/6).
The learner is a Hindi-native speaker.

Their spoken text: "{user_text}"

Respond in this EXACT JSON format:
{{
    "errors": [
        {{
            "original": "exact sentence with the error",
            "corrected": "the corrected sentence",
            "rule": "the grammar rule explained simply",
            "category": "tense/articles/subject-verb/preposition/word-order"
        }}
    ],
    "error_categories": ["list the types of errors found"],
    "score": 42
}}

Score 0-100 where: 0-16=many errors, 17-33=frequent errors, 34-50=some errors, 51-67=occasional errors, 68-84=few errors, 85-100=near-perfect.
Focus on common Hindi-speaker grammar patterns: missing articles, tense confusion, subject-verb agreement, preposition errors.
Be specific: quote the EXACT sentence with the error and provide the corrected version with the rule.
Return ONLY valid JSON, no markdown."""

    try:
        response = llm.invoke(prompt)
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        result = json.loads(content.strip())
        state["grammar_result"] = result
    except Exception as e:
        logger.error(f"Grammar analysis failed: {e}")
        state["grammar_result"] = {
            "errors": [],
            "error_categories": [],
            "score": 50,
        }

    return state


def aggregate_feedback(state: FeedbackState) -> FeedbackState:
    """Aggregate results from all three analyzers into a final report."""
    pron = state.get("pronunciation_result", {})
    vocab = state.get("vocabulary_result", {})
    gram = state.get("grammar_result", {})

    pron_score = pron.get("score", 50)
    vocab_score = vocab.get("score", 50)
    gram_score = gram.get("score", 50)
    overall_score = round((pron_score + vocab_score + gram_score) / 3)

    # Generate strengths — always highlight at least one positive
    strengths = []
    if pron_score >= 50:
        strengths.append("Your pronunciation is clear and understandable")
    if vocab_score >= 50:
        strengths.append("You use a good variety of vocabulary")
    if gram_score >= 50:
        strengths.append("Your grammar is solid for your level")
    if not strengths:
        strengths.append("You showed great effort and willingness to communicate")
        strengths.append("You attempted to express complex ideas, which shows progress")

    encouragement_messages = {
        1: "Keep practising daily — every conversation makes you stronger! 💪",
        2: "You're building a solid foundation. Keep going! 🌱",
        3: "Great progress! You're becoming more confident with each session. ⭐",
        4: "Impressive! You're communicating effectively. Let's refine the details. 🚀",
        5: "Excellent work! You're approaching fluency. 🎯",
        6: "Outstanding! Your English is highly proficient. 🏆",
    }
    level = score_to_level(overall_score)

    state["aggregated_report"] = {
        "pronunciation": {
            "score": pron_score,
            "level": score_to_level(pron_score),
            **{k: v for k, v in pron.items() if k != "score"},
        },
        "vocabulary": {
            "score": vocab_score,
            "level": score_to_level(vocab_score),
            **{k: v for k, v in vocab.items() if k != "score"},
        },
        "grammar": {
            "score": gram_score,
            "level": score_to_level(gram_score),
            **{k: v for k, v in gram.items() if k != "score"},
        },
        "overall_score": overall_score,
        "overall_level": level,
        "strengths": strengths,
        "encouragement": encouragement_messages.get(level, encouragement_messages[2]),
    }

    return state


def build_feedback_pipeline():
    """Build the LangGraph feedback pipeline."""
    graph = StateGraph(FeedbackState)

    # Three sequential analysis nodes → aggregator
    graph.add_node("analyze_pronunciation", analyze_pronunciation)
    graph.add_node("analyze_vocabulary", analyze_vocabulary)
    graph.add_node("analyze_grammar", analyze_grammar)
    graph.add_node("aggregate", aggregate_feedback)

    graph.set_entry_point("analyze_pronunciation")
    graph.add_edge("analyze_pronunciation", "analyze_vocabulary")
    graph.add_edge("analyze_vocabulary", "analyze_grammar")
    graph.add_edge("analyze_grammar", "aggregate")
    graph.add_edge("aggregate", END)

    return graph.compile()


feedback_pipeline = build_feedback_pipeline()
