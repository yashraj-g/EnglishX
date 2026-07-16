'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { getLearnerDashboard } from '@/lib/api';
import styles from './dashboard.module.css';

const LEVEL_NAMES = ['', 'Beginner', 'Elementary', 'Intermediate', 'Upper-Int', 'Advanced', 'Proficient'];
const LEVEL_COLORS = ['', '#ef4444', '#f59e0b', '#eab308', '#10b981', '#6366f1', '#a855f7'];

function ScoreRing({ score, size = 80, strokeWidth = 6, color }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
      </svg>
      <span className="score-value" style={{ color }}>{score}</span>
    </div>
  );
}

export default function DashboardPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (user.role === 'admin') { router.push('/admin'); return; }

    async function fetchDashboard() {
      setLoading(true);
      setErrorStatus(null);
      try {
        const data = await getLearnerDashboard(token);
        setDashboard(data);
      } catch (err) {
        console.error('Dashboard fetch failed:', err);
        setErrorStatus(err.status || 500);
      }
      setLoading(false);
    }
    fetchDashboard();
  }, [user, token, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className={styles.page}>
        <div className="container">
          <div className={styles.skeletonGrid}>
            {[1,2,3,4].map(i => <div key={i} className={`skeleton ${styles.skeletonCard}`} />)}
          </div>
        </div>
      </div>
    );
  }

  if (errorStatus === 401) {
    return (
      <div className={styles.page}>
        <div className="container" style={{ textAlign: 'center', paddingTop: '100px' }}>
          <h2>Session Expired</h2>
          <p className="text-secondary" style={{ marginBottom: '24px' }}>
            Your session has expired. Please log in again to access your dashboard.
          </p>
          <button className="btn btn-primary" onClick={() => router.push('/login')}>
            🔑 Log In Again
          </button>
        </div>
      </div>
    );
  }

  if (errorStatus || !dashboard) {
    return (
      <div className={styles.page}>
        <div className="container" style={{ textAlign: 'center', paddingTop: '100px' }}>
          <h2>Unable to load dashboard</h2>
          <p className="text-secondary" style={{ marginBottom: '24px' }}>
            Please check your connection and try again.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              setErrorStatus(null);
              setLoading(true);
              getLearnerDashboard(token)
                .then(data => {
                  setDashboard(data);
                  setLoading(false);
                })
                .catch(err => {
                  console.error('Retry failed:', err);
                  setErrorStatus(err.status || 500);
                  setLoading(false);
                });
            }}
          >
            🔄 Try Again
          </button>
        </div>
      </div>
    );
  }

  const { levels, practiceStreak, recentSessions, recentFeedback } = dashboard;

  return (
    <div className={styles.page}>
      <div className="container">
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.greeting}>
              Hey, {user?.name?.split(' ')[0]} 👋
            </h1>
            <p className="text-secondary">
              {practiceStreak > 0
                ? `🔥 ${practiceStreak}-day streak! Keep it going.`
                : "Start practising to build your streak!"}
            </p>
          </div>
          <Link href="/practice" className="btn btn-primary btn-lg">
            🎤 Start Practising
          </Link>
        </div>

        {/* Level Cards */}
        <div className={`${styles.levelCards} animate-fadeInUp`}>
          {['pronunciation', 'vocabulary', 'grammar', 'overall'].map((dim) => {
            const level = levels?.[dim] || 1;
            const color = LEVEL_COLORS[level];
            const score = level * 16; // approximate visual
            return (
              <div key={dim} className={`card ${styles.levelCard}`}>
                <div className={styles.levelCardHeader}>
                  <span className={styles.levelDimension}>
                    {dim.charAt(0).toUpperCase() + dim.slice(1)}
                  </span>
                  <span className={`level-badge level-${level}`}>L{level}</span>
                </div>
                <ScoreRing score={score} color={color} />
                <div className={styles.levelName} style={{ color }}>
                  {LEVEL_NAMES[level]}
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Sessions */}
        <div className={`${styles.section} animate-fadeInUp stagger-2`}>
          <div className={styles.sectionHeader}>
            <h2>Recent Sessions</h2>
            <Link href="/practice" className="btn btn-ghost btn-sm">View All →</Link>
          </div>

          {recentSessions && recentSessions.length > 0 ? (
            <div className={styles.sessionList}>
              {recentSessions.slice(0, 5).map((session) => (
                <div key={session.id} className={`card ${styles.sessionItem}`}>
                  <div className={styles.sessionMode}>
                    {session.mode === 'free_talk' ? '💬' : session.mode === 'hr_interview' ? '💼' : '📋'}
                    <span>{session.mode.replace('_', ' ')}</span>
                  </div>
                  <div className={styles.sessionMeta}>
                    <span>{session.turn_count || 0} turns</span>
                    <span>·</span>
                    <span>{session.duration_seconds ? `${Math.round(session.duration_seconds / 60)}m` : '—'}</span>
                  </div>
                  <div className={styles.sessionDate}>
                    {new Date(session.started_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short',
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <p>No sessions yet. Start practising to see your history here!</p>
              <Link href="/practice" className="btn btn-primary">🎤 Start Your First Session</Link>
            </div>
          )}
        </div>

        {/* Recent Feedback */}
        {recentFeedback && recentFeedback.length > 0 && (
          <div className={`${styles.section} animate-fadeInUp stagger-3`}>
            <h2 className={styles.sectionHeader}>Latest Feedback</h2>
            <div className={styles.feedbackList}>
              {recentFeedback.slice(0, 3).map((fb) => (
                <div key={fb.id} className={`card ${styles.feedbackItem}`}>
                  <div className={styles.feedbackScores}>
                    <div className={styles.fbScore}>
                      <span className={styles.fbLabel}>Pron</span>
                      <span className={styles.fbVal}>{fb.pronunciation_score}</span>
                    </div>
                    <div className={styles.fbScore}>
                      <span className={styles.fbLabel}>Vocab</span>
                      <span className={styles.fbVal}>{fb.vocabulary_score}</span>
                    </div>
                    <div className={styles.fbScore}>
                      <span className={styles.fbLabel}>Grammar</span>
                      <span className={styles.fbVal}>{fb.grammar_score}</span>
                    </div>
                    <div className={`${styles.fbScore} ${styles.fbOverall}`}>
                      <span className={styles.fbLabel}>Overall</span>
                      <span className={styles.fbVal}>{fb.overall_score}</span>
                    </div>
                  </div>
                  <div className={styles.fbDate}>
                    {new Date(fb.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
