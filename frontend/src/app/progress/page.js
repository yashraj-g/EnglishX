'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { getSessionHistory, getLevelTrend, getSessionFeedback, getSessionAudio } from '@/lib/api';
import AudioPlayer from '@/components/AudioPlayer';
import styles from './progress.module.css';

const LEVEL_NAMES = ['', 'Beginner', 'Elementary', 'Intermediate', 'Upper-Int', 'Advanced', 'Proficient'];
const LEVEL_COLORS = ['', '#ef4444', '#f59e0b', '#eab308', '#10b981', '#6366f1', '#a855f7'];

export default function ProgressPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();

  // Progress States
  const [sessions, setSessions] = useState([]);
  const [activeTab, setActiveTab] = useState('overall'); // overall | pronunciation | vocabulary | grammar
  const [trendData, setTrendData] = useState([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  // Lazy Loaded Session Details: { [sessionId]: { loading, feedback, audio, error } }
  const [expandedSessions, setExpandedSessions] = useState({});

  // Fetch initial history
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }

    async function loadData() {
      try {
        const history = await getSessionHistory(token, 30);
        setSessions(history || []);
      } catch (err) {
        console.error('Failed to load session history:', err);
      } finally {
        setPageLoading(false);
      }
    }
    loadData();
  }, [user, token, authLoading, router]);

  // Fetch trend data whenever activeTab changes
  useEffect(() => {
    if (!token || authLoading || !user) return;

    async function loadTrend() {
      setTrendLoading(true);
      try {
        const trend = await getLevelTrend(token, activeTab);
        // Clean up duplicates or handle reverse sorting (oldest to newest)
        const sorted = (trend || []).slice().reverse();
        setTrendData(sorted);
      } catch (err) {
        console.error(`Failed to load trend for ${activeTab}:`, err);
      } finally {
        setTrendLoading(false);
      }
    }
    loadTrend();
  }, [token, activeTab, authLoading, user]);

  // Expand and Lazy-Load Session details
  const toggleSession = useCallback(async (sessionId) => {
    // If already expanded, collapse it
    if (expandedSessions[sessionId] && !expandedSessions[sessionId].collapsed) {
      setExpandedSessions(prev => ({
        ...prev,
        [sessionId]: { ...prev[sessionId], collapsed: true }
      }));
      return;
    }

    // If already loaded and collapsed, just expand it
    if (expandedSessions[sessionId]) {
      setExpandedSessions(prev => ({
        ...prev,
        [sessionId]: { ...prev[sessionId], collapsed: false }
      }));
      return;
    }

    // Otherwise, lazy-load feedback & audio
    setExpandedSessions(prev => ({
      ...prev,
      [sessionId]: { loading: true, collapsed: false, feedback: null, audio: null }
    }));

    try {
      const [feedback, audioData] = await Promise.all([
        getSessionFeedback(token, sessionId).catch(err => {
          console.warn('Feedback not found for session', sessionId);
          return null;
        }),
        getSessionAudio(token, sessionId).catch(err => {
          console.warn('Audio not found for session', sessionId);
          return { turns: [] };
        })
      ]);

      setExpandedSessions(prev => ({
        ...prev,
        [sessionId]: {
          loading: false,
          collapsed: false,
          feedback,
          audio: audioData?.turns || [],
        }
      }));
    } catch (err) {
      console.error('Failed to load session details:', err);
      setExpandedSessions(prev => ({
        ...prev,
        [sessionId]: { loading: false, collapsed: false, error: true }
      }));
    }
  }, [token, expandedSessions]);

  // Calculate SVG line chart parameters
  const svgPath = useMemo(() => {
    if (trendData.length < 2) return '';
    const width = 600;
    const height = 180;
    const padding = 25;

    const points = trendData.map((d, i) => {
      const x = padding + (i / (trendData.length - 1)) * (width - padding * 2);
      // invert y (100 is at top, 0 at bottom)
      const y = height - padding - (d.score / 100) * (height - padding * 2);
      return { x, y };
    });

    // Generate path
    return points.reduce((path, p, i) => {
      return i === 0 ? `M ${p.x} ${p.y}` : `${path} L ${p.x} ${p.y}`;
    }, '');
  }, [trendData]);

  // Render Svg Chart Points
  const svgPoints = useMemo(() => {
    if (trendData.length === 0) return [];
    const width = 600;
    const height = 180;
    const padding = 25;

    return trendData.map((d, i) => {
      const x = padding + (i / (Math.max(1, trendData.length - 1))) * (width - padding * 2);
      const y = height - padding - (d.score / 100) * (height - padding * 2);
      return { x, y, score: d.score, date: new Date(d.recorded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), level: d.level };
    });
  }, [trendData]);

  if (authLoading || pageLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className="container">
          <div className={styles.skeletonHeader} />
          <div className={styles.skeletonGrid}>
            <div className={`skeleton ${styles.skeletonCard}`} />
            <div className={`skeleton ${styles.skeletonCard}`} />
          </div>
        </div>
      </div>
    );
  }

  // Dimension Stats
  const currentLevels = {
    overall: user?.overallLevel || 1,
    pronunciation: user?.pronunciationLevel || 1,
    vocabulary: user?.vocabularyLevel || 1,
    grammar: user?.grammarLevel || 1,
  };

  return (
    <div className={styles.page}>
      <div className="container">
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Learning Progress</h1>
            <p className="text-secondary">Track your speaking competency improvement and listen to your recordings.</p>
          </div>
          <Link href="/practice" className="btn btn-primary">
            🎤 Start Practising
          </Link>
        </div>

        {/* Competency Level Rings */}
        <div className={styles.competencyGrid}>
          {['overall', 'pronunciation', 'vocabulary', 'grammar'].map((dim) => {
            const level = currentLevels[dim];
            const color = LEVEL_COLORS[level];
            return (
              <div
                key={dim}
                className={`${styles.competencyCard} ${activeTab === dim ? styles.activeCard : ''}`}
                onClick={() => setActiveTab(dim)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setActiveTab(dim)}
              >
                <div className={styles.compLabel}>
                  {dim === 'overall' ? '✨ Overall Level' : dim.charAt(0).toUpperCase() + dim.slice(1)}
                </div>
                <div className={styles.levelRingSection}>
                  <div className={styles.badge} style={{ backgroundColor: `${color}15`, color, border: `1px solid ${color}40` }}>
                    L{level}
                  </div>
                  <span className={styles.levelName} style={{ color }}>{LEVEL_NAMES[level]}</span>
                </div>
                <div className={styles.cardIndicator}>
                  {activeTab === dim ? '• Active View' : 'Click to view trend'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Trend Graph Card */}
        <div className={`card ${styles.graphCard}`}>
          <div className={styles.graphHeader}>
            <div>
              <h3>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Trend</h3>
              <p className="text-secondary">Rolling CEFR average based on past practice sessions</p>
            </div>
            <div className={styles.tabList}>
              {['overall', 'pronunciation', 'vocabulary', 'grammar'].map(t => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`${styles.tabBtn} ${activeTab === t ? styles.activeTabBtn : ''}`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.graphContainer}>
            {trendLoading ? (
              <div className={styles.graphPlaceholder}>Loading trend data...</div>
            ) : trendData.length === 0 ? (
              <div className={styles.graphPlaceholder}>No trend history found. Complete a practice session to start!</div>
            ) : (
              <div className={styles.svgWrapper}>
                <svg viewBox="0 0 600 180" className={styles.chartSvg}>
                  {/* Grid Lines */}
                  {[0, 25, 50, 75, 100].map((gridVal) => {
                    const yVal = 180 - 25 - (gridVal / 100) * 130;
                    return (
                      <g key={gridVal}>
                        <line x1="25" y1={yVal} x2="575" y2={yVal} stroke="rgba(255,255,255,0.04)" strokeDasharray="3,3" />
                        <text x="5" y={yVal + 4} fill="rgba(255,255,255,0.2)" fontSize="10">{gridVal}</text>
                      </g>
                    );
                  })}

                  {/* SVG Gradient */}
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Filled Area */}
                  {trendData.length >= 2 && (
                    <path
                      d={`${svgPath} L ${svgPoints[svgPoints.length - 1].x} 155 L ${svgPoints[0].x} 155 Z`}
                      fill="url(#chartGradient)"
                    />
                  )}

                  {/* Line Path */}
                  {trendData.length >= 2 ? (
                    <path d={svgPath} fill="none" stroke="#f59e0b" strokeWidth="3" />
                  ) : (
                    // Single node fallback line
                    <line x1="25" y1="90" x2="575" y2="90" stroke="rgba(255,255,255,0.06)" />
                  )}

                  {/* glowing dots */}
                  {svgPoints.map((p, idx) => (
                    <g key={idx} className={styles.dotGroup}>
                      <circle cx={p.x} cy={p.y} r="5" fill="#f59e0b" className={styles.chartDot} />
                      <circle cx={p.x} cy={p.y} r="10" fill="#f59e0b" fillOpacity="0.15" />
                      {/* Tooltip on hover (CSS handled) */}
                      <g className={styles.tooltip}>
                        <rect x={p.x - 35} y={p.y - 42} width="70" height="32" rx="4" fill="rgba(15,15,18,0.95)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                        <text x={p.x} y={p.y - 30} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">Score: {Math.round(p.score)}</text>
                        <text x={p.x} y={p.y - 18} textAnchor="middle" fill="#f59e0b" fontSize="8">Level L{p.level}</text>
                      </g>
                      {/* X axis labels (Dates) */}
                      {idx % Math.ceil(trendData.length / 6) === 0 && (
                        <text x={p.x} y="172" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9">{p.date}</text>
                      )}
                    </g>
                  ))}
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Sessions & Feedback History Section */}
        <div className={styles.historySection}>
          <h2 className={styles.sectionTitle}>Session History</h2>
          {sessions.length === 0 ? (
            <div className={styles.emptyState}>
              <p>You haven&apos;t completed any sessions yet.</p>
              <Link href="/practice" className="btn btn-primary">Start Your First Session</Link>
            </div>
          ) : (
            <div className={styles.sessionTimeline}>
              {sessions.map((session) => {
                const isExpanded = expandedSessions[session.id] && !expandedSessions[session.id].collapsed;
                const details = expandedSessions[session.id];

                return (
                  <div key={session.id} className={`card ${styles.sessionCardItem} ${isExpanded ? styles.expandedCardItem : ''}`}>
                    {/* Top Brief Header */}
                    <div className={styles.sessionOverview} onClick={() => toggleSession(session.id)}>
                      <div className={styles.sessionLeft}>
                        <div className={styles.modeIcon}>
                          {session.mode === 'free_talk' ? '💬' : session.mode === 'hr_interview' ? '💼' : '📋'}
                        </div>
                        <div>
                          <h4 className={styles.modeName}>{session.mode.replace('_', ' ').toUpperCase()}</h4>
                          <span className={styles.sessionDate}>
                            {new Date(session.started_at).toLocaleDateString('en-GB', {
                              day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>

                      <div className={styles.sessionOverviewScores}>
                        <div className={styles.compactScore}>
                          <span className={styles.scoreLabel}>Pron</span>
                          <span className={styles.scoreVal} style={{ color: LEVEL_COLORS[scoreToLevel(session.pronunciation_score || 0)] }}>
                            {session.pronunciation_score !== null ? Math.round(session.pronunciation_score) : '—'}
                          </span>
                        </div>
                        <div className={styles.compactScore}>
                          <span className={styles.scoreLabel}>Vocab</span>
                          <span className={styles.scoreVal} style={{ color: LEVEL_COLORS[scoreToLevel(session.vocabulary_score || 0)] }}>
                            {session.vocabulary_score !== null ? Math.round(session.vocabulary_score) : '—'}
                          </span>
                        </div>
                        <div className={styles.compactScore}>
                          <span className={styles.scoreLabel}>Grammar</span>
                          <span className={styles.scoreVal} style={{ color: LEVEL_COLORS[scoreToLevel(session.grammar_score || 0)] }}>
                            {session.grammar_score !== null ? Math.round(session.grammar_score) : '—'}
                          </span>
                        </div>
                        <div className={`${styles.compactScore} ${styles.overallScoreBox}`}>
                          <span className={styles.scoreLabel}>Overall</span>
                          <span className={styles.scoreVal} style={{ color: LEVEL_COLORS[scoreToLevel(session.overall_score || 0)] }}>
                            {session.overall_score !== null ? Math.round(session.overall_score) : '—'}
                          </span>
                        </div>
                      </div>

                      <button className={styles.expandButton}>
                        {isExpanded ? '▲ Collapse' : '▼ View Details'}
                      </button>
                    </div>

                    {/* Detailed Expanded View */}
                    {isExpanded && (
                      <div className={styles.expandedContent}>
                        {details.loading ? (
                          <div className={styles.loader}>Fetching recordings and analysis...</div>
                        ) : details.error ? (
                          <div className={styles.detailError}>Failed to load details for this session.</div>
                        ) : (
                          <div className={styles.detailsGrid}>
                            
                            {/* Left Pane: Detailed Feedback and Critique */}
                            <div className={styles.feedbackPane}>
                              {details.feedback ? (
                                <>
                                  <div className={styles.encouragementBlock}>
                                    <h5>🎯 Summary & Encouragement</h5>
                                    <p>{details.feedback.pronunciation_details?.encouragement || details.feedback.encouragement || "Great effort in practicing! Keep speaking to build confidence."}</p>
                                  </div>

                                  <div className={styles.strengthsBlock}>
                                    <h5>💪 Strengths</h5>
                                    <ul>
                                      {(details.feedback.strengths || []).length > 0 ? (
                                        (details.feedback.strengths || []).map((s, idx) => <li key={idx}>{s}</li>)
                                      ) : (
                                        <li>Good engagement and turn responses.</li>
                                      )}
                                    </ul>
                                  </div>

                                  {/* Multi-Dimension Analysis */}
                                  <div className={styles.dimensionDetails}>
                                    <h5>Detailed Critique</h5>
                                    
                                    {/* Pronunciation Details */}
                                    <div className={styles.dimDetailItem}>
                                      <span className={styles.dimDetailName}>Pronunciation</span>
                                      <p>{details.feedback.pronunciation_details?.feedback || "Clear articulation overall. Practise pacing and word accents."}</p>
                                    </div>

                                    {/* Vocabulary Details */}
                                    <div className={styles.dimDetailItem}>
                                      <span className={styles.dimDetailName}>Vocabulary</span>
                                      <p>{details.feedback.vocabulary_details?.feedback || "Good choice of verbs. Expand vocabulary with native idioms."}</p>
                                    </div>

                                    {/* Grammar Details */}
                                    <div className={styles.dimDetailItem}>
                                      <span className={styles.dimDetailName}>Grammar</span>
                                      <p>{details.feedback.grammar_details?.feedback || "Minor errors in verb tenses or prepositions. Sentence structures are mostly solid."}</p>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <p className="text-secondary">Feedback report is empty or was not fully generated for this session.</p>
                              )}
                            </div>

                            {/* Right Pane: Turn-by-Turn Transcript and Playback */}
                            <div className={styles.transcriptPane}>
                              <h5>🎙 Transcript & Audio Playback</h5>
                              <div className={styles.transcriptList}>
                                {session.transcript && Array.isArray(session.transcript) && session.transcript.length > 0 ? (
                                  session.transcript.map((turn, i) => {
                                    if (turn.role !== 'user') return null;
                                    const turnIndex = Math.floor(i / 2);
                                    const audioTurn = (details.audio || []).find(a => a.turnIndex === turnIndex);
                                    const aiResponse = session.transcript[i + 1];

                                    return (
                                      <div key={i} className={styles.turnBlock}>
                                        <div className={styles.turnUserHeader}>
                                          <span className={styles.turnLabel}>Turn {turnIndex + 1}</span>
                                          {audioTurn && audioTurn.presignedUrl ? (
                                            <div className={styles.playerWrapper}>
                                              <AudioPlayer presignedUrl={audioTurn.presignedUrl} compact />
                                            </div>
                                          ) : (
                                            <span className={styles.noAudioBadge}>No recording</span>
                                          )}
                                        </div>
                                        <p className={styles.turnText}>&quot;{turn.content}&quot;</p>
                                        
                                        {/* AI response matching this turn */}
                                        {aiResponse && aiResponse.role === 'ai' && (
                                          <div className={styles.aiReplyBlock}>
                                            <span className={styles.aiReplyLabel}>AI Coach</span>
                                            <p className={styles.aiReplyText}>{aiResponse.content}</p>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })
                                ) : (
                                  <p className="text-secondary">No transcripts recorded for this session.</p>
                                )}
                              </div>
                            </div>

                          </div>
                        )}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function scoreToLevel(score) {
  if (score >= 85) return 6;
  if (score >= 68) return 5;
  if (score >= 51) return 4;
  if (score >= 34) return 3;
  if (score >= 17) return 2;
  return 1;
}
