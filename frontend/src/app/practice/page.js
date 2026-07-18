'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { startSession, endSession, processTurn, analyzeSession, saveSessionFeedback, registerAudioKey } from '@/lib/api';
import styles from './practice.module.css';

const MODES = [
  { id: 'free_talk', label: 'Free Talk', icon: '💬', desc: 'Casual conversation on any topic' },
  { id: 'hr_interview', label: 'HR Interview', icon: '💼', desc: 'Practice job interview questions' },
  { id: 'placement', label: 'Placement Test', icon: '📋', desc: 'Assess your current level' },
];

export default function PracticePage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const { isRecording, error: micError, startRecording, stopRecording, cancelRecording } = useAudioRecorder();
  const { isSpeaking, playTTS, stopSpeaking } = useAudioPlayer();

  const [phase, setPhase] = useState('select'); // select | conversation | analyzing | feedback
  const [selectedMode, setSelectedMode] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [sessionStart, setSessionStart] = useState(null);
  const [wordConfidences, setWordConfidences] = useState([]);
  const chatEndRef = useRef(null);
  const turnCountRef = useRef(0); // Track turn index for S3 key namespacing

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // TTS playback — uses Deepgram Aura via /speech/tts endpoint
  const speak = useCallback((text) => {
    playTTS(text);
  }, [playTTS]);

  async function handleStartSession(mode) {
    setSelectedMode(mode);
    setProcessing(true);
    try {
      const session = await startSession(token, { mode });
      setSessionId(session.id);
      setSessionStart(Date.now());
      setPhase('conversation');

      // Get initial AI greeting
      const result = await processTurn({
        sessionId: session.id,
        textInput: 'Hello',
        mode,
        learnerLevel: user?.overallLevel || 2,
        conversationHistory: [],
      });

      setMessages([
        { role: 'ai', content: result.ai_reply },
      ]);
      speak(result.ai_reply);
    } catch (err) {
      console.error('Failed to start session:', err);
    }
    setProcessing(false);
  }

  async function handleSendAudio() {
    setProcessing(true);
    try {
      const audioBase64 = await stopRecording();
      if (!audioBase64) {
        setProcessing(false);
        return;
      }

      const result = await processTurn({
        sessionId,
        audioBase64,
        mode: selectedMode,
        learnerLevel: user?.overallLevel || 2,
        conversationHistory: messages.map(m => ({
          role: m.role === 'ai' ? 'ai' : 'user',
          content: m.content,
        })),
        userId: user?.id,
        turnIndex: turnCountRef.current,
      });

      // Register the S3 audio key with ms1 (best-effort, non-blocking)
      if (result.audio_s3_key) {
        registerAudioKey(token, sessionId, turnCountRef.current, result.audio_s3_key).catch(
          (err) => console.warn('Failed to register audio key:', err)
        );
      }
      turnCountRef.current += 1;

      if (result.word_confidences) {
        setWordConfidences(prev => [...prev, ...result.word_confidences]);
      }

      setMessages(prev => [
        ...prev,
        { role: 'user', content: result.user_transcript, word_confidences: result.word_confidences },
        { role: 'ai', content: result.ai_reply },
      ]);

      speak(result.ai_reply);
    } catch (err) {
      console.error('Turn failed:', err);
    }
    setProcessing(false);
  }

  async function handleSendText(e) {
    e.preventDefault();
    if (!textInput.trim()) return;
    const text = textInput;
    setTextInput('');
    setProcessing(true);

    try {
      const result = await processTurn({
        sessionId,
        textInput: text,
        mode: selectedMode,
        learnerLevel: user?.overallLevel || 2,
        conversationHistory: messages.map(m => ({
          role: m.role === 'ai' ? 'ai' : 'user',
          content: m.content,
        })),
        userId: user?.id,
        turnIndex: turnCountRef.current,
      });
      turnCountRef.current += 1;

      setMessages(prev => [
        ...prev,
        { role: 'user', content: text },
        { role: 'ai', content: result.ai_reply },
      ]);

      speak(result.ai_reply);
    } catch (err) {
      console.error('Turn failed:', err);
    }
    setProcessing(false);
  }

  async function handleEndSession() {
    setPhase('analyzing');
    const durationSeconds = Math.round((Date.now() - sessionStart) / 1000);

    try {
      await endSession(token, sessionId, {
        durationSeconds,
        turnCount: messages.filter(m => m.role === 'user').length,
        transcript: messages.map(m => ({
          role: m.role,
          content: m.content,
          word_confidences: m.word_confidences || [],
        })),
      });

      const analysisResult = await analyzeSession({
        sessionId,
        transcript: messages.map(m => ({
          role: m.role,
          content: m.content,
          word_confidences: m.word_confidences || [],
        })),
        mode: selectedMode,
        learnerLevel: user?.overallLevel || 2,
      });

      // Save feedback to ms1
      try {
        await saveSessionFeedback(token, sessionId, analysisResult);
      } catch (e) {
        console.warn('Failed to save feedback to ms1:', e);
      }

      setFeedback(analysisResult);
      setPhase('feedback');
    } catch (err) {
      console.error('Analysis failed:', err);
      setPhase('feedback');
      setFeedback(null);
    }
  }

  if (authLoading) return null;

  // ─── Mode Selection ───
  if (phase === 'select') {
    return (
      <div className={styles.page}>
        <div className="container">
          <div className={styles.selectHeader}>
            <h1>Choose Your Practice Mode</h1>
            <p className="text-secondary">Pick how you want to practise today</p>
          </div>
          <div className={styles.modeGrid}>
            {MODES.map(mode => (
              <button
                key={mode.id}
                className={`card card-interactive ${styles.modeCard}`}
                onClick={() => handleStartSession(mode.id)}
                disabled={processing}
              >
                <div className={styles.modeIcon}>{mode.icon}</div>
                <h3>{mode.label}</h3>
                <p>{mode.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Analyzing ───
  if (phase === 'analyzing') {
    return (
      <div className={styles.page}>
        <div className={styles.analyzing}>
          <div className={styles.analyzeSpinner} />
          <h2>Analysing your session...</h2>
          <p className="text-secondary">Our AI is reviewing your pronunciation, vocabulary, and grammar</p>
        </div>
      </div>
    );
  }

  // ─── Feedback ───
  if (phase === 'feedback') {
    return (
      <div className={styles.page}>
        <div className="container">
          <div className={styles.feedbackPage}>
            <h1>Session Feedback</h1>

            {feedback ? (
              <>
                {/* Score Cards */}
                <div className={styles.feedbackScoreGrid}>
                  {[
                    { label: 'Pronunciation', score: feedback.pronunciationScore, details: feedback.pronunciationDetails },
                    { label: 'Vocabulary', score: feedback.vocabularyScore, details: feedback.vocabularyDetails },
                    { label: 'Grammar', score: feedback.grammarScore, details: feedback.grammarDetails },
                  ].map(dim => (
                    <div key={dim.label} className={`card ${styles.feedbackDimCard}`}>
                      <div className={styles.feedbackDimHeader}>
                        <h3>{dim.label}</h3>
                        <span className={styles.feedbackDimScore} style={{
                          color: dim.score >= 68 ? 'var(--accent-400)' : dim.score >= 34 ? 'var(--warning-400)' : 'var(--danger-400)'
                        }}>
                          {dim.score}
                        </span>
                      </div>

                      {/* Pronunciation details */}
                      {dim.label === 'Pronunciation' && dim.details?.mispronounced_words?.length > 0 && (
                        <div className={styles.detailSection}>
                          <h4>Mispronounced Words</h4>
                          {dim.details.mispronounced_words.map((w, i) => (
                            <div key={i} className={styles.detailItem}>
                              <span className={styles.detailBad}>{w.said_as || w.word}</span>
                              <span>→</span>
                              <span className={styles.detailGood}>{w.word}</span>
                              {w.tip && <p className={styles.detailTip}>💡 {w.tip}</p>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Vocabulary details */}
                      {dim.label === 'Vocabulary' && dim.details?.better_alternatives?.length > 0 && (
                        <div className={styles.detailSection}>
                          <h4>Better Word Choices</h4>
                          {dim.details.better_alternatives.map((w, i) => (
                            <div key={i} className={styles.detailItem}>
                              <span className={styles.detailBad}>{w.used}</span>
                              <span>→</span>
                              <span className={styles.detailGood}>{w.suggestion}</span>
                              {w.context && <p className={styles.detailTip}>e.g. "{w.context}"</p>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Grammar details */}
                      {dim.label === 'Grammar' && dim.details?.errors?.length > 0 && (
                        <div className={styles.detailSection}>
                          <h4>Grammar Corrections</h4>
                          {dim.details.errors.map((err, i) => (
                            <div key={i} className={styles.detailItem}>
                              <span className={styles.detailBad}>{err.original}</span>
                              <span>→</span>
                              <span className={styles.detailGood}>{err.corrected}</span>
                              {err.rule && <p className={styles.detailTip}>📖 {err.rule}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Overall & Strengths */}
                <div className={`card ${styles.overallCard}`}>
                  <div className={styles.overallScore}>
                    <span>Overall Score</span>
                    <span className={styles.overallNum}>{feedback.overallScore}</span>
                  </div>
                  {feedback.strengths?.length > 0 && (
                    <div className={styles.strengths}>
                      <h4>💪 Strengths</h4>
                      <ul>
                        {feedback.strengths.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                  {feedback.encouragement && (
                    <p className={styles.encouragement}>{feedback.encouragement}</p>
                  )}
                </div>
              </>
            ) : (
              <div className={styles.emptyFeedback}>
                <p>Feedback could not be generated. Try again next session!</p>
              </div>
            )}

            <div className={styles.feedbackActions}>
              <button className="btn btn-primary btn-lg" onClick={() => {
                setPhase('select');
                setMessages([]);
                setFeedback(null);
                setSessionId(null);
                setWordConfidences([]);
              }}>
                Practise Again
              </button>
              <button className="btn btn-secondary btn-lg" onClick={() => router.push('/dashboard')}>
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Conversation ───
  return (
    <div className={styles.page}>
      <div className={styles.conversation}>
        {/* Conversation header */}
        <div className={styles.convHeader}>
          <div className={styles.convMode}>
            {MODES.find(m => m.id === selectedMode)?.icon}{' '}
            {MODES.find(m => m.id === selectedMode)?.label}
          </div>
          <button className="btn btn-danger btn-sm" onClick={handleEndSession}>
            End Session
          </button>
        </div>

        {/* Messages */}
        <div className={styles.messages}>
          {messages.map((msg, i) => (
            <div key={i} className={`${styles.message} ${msg.role === 'user' ? styles.userMsg : styles.aiMsg}`}>
              <div className={styles.msgAvatar}>
                {msg.role === 'user' ? user?.name?.charAt(0) || 'U' : '✦'}
              </div>
              <div className={styles.msgBubble}>
                <p>{msg.content}</p>
              </div>
            </div>
          ))}
          {processing && (
            <div className={`${styles.message} ${styles.aiMsg}`}>
              <div className={styles.msgAvatar}>✦</div>
              <div className={`${styles.msgBubble} ${styles.typing}`}>
                <span /><span /><span />
              </div>
            </div>
          )}
          {isSpeaking && !processing && (
            <div className={styles.speakingIndicator}>
              <span className={styles.speakingDot} />
              <span className={styles.speakingDot} />
              <span className={styles.speakingDot} />
              <span className={styles.speakingText}>Speaking...</span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div className={styles.inputArea}>
          {micError && <div className={styles.micError}>{micError}</div>}
          <div className={styles.inputRow}>
            <button
              className={`btn btn-icon ${isRecording ? styles.recordingBtn : styles.micBtn}`}
              onClick={isRecording ? handleSendAudio : startRecording}
              disabled={processing}
              title={isRecording ? 'Stop & send' : 'Hold to speak'}
            >
              {isRecording ? '⏹' : '🎤'}
            </button>
            {isRecording && (
              <div className={styles.recordingIndicator}>
                <span className={styles.recordingDot} />
                Recording... tap to send
              </div>
            )}
            {!isRecording && (
              <form className={styles.textForm} onSubmit={handleSendText}>
                <input
                  type="text"
                  className="input"
                  placeholder="Or type your message..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  disabled={processing}
                />
                <button type="submit" className="btn btn-primary btn-sm" disabled={processing || !textInput.trim()}>
                  Send
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
