'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getAdminDashboard, getBatches, createBatch, createInvite, getInvites } from '@/lib/api';
import styles from './admin.module.css';

export default function AdminPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [dashboard, setDashboard] = useState(null);
  const [batches, setBatches] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Batch form
  const [batchName, setBatchName] = useState('');
  const [batchDesc, setBatchDesc] = useState('');

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteBatchId, setInviteBatchId] = useState('');

  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (user.role !== 'admin') { router.push('/dashboard'); return; }

    async function fetchData() {
      try {
        const [dashData, batchData, inviteData] = await Promise.all([
          getAdminDashboard(token),
          getBatches(token),
          getInvites(token),
        ]);
        setDashboard(dashData);
        setBatches(batchData);
        setInvites(inviteData);
      } catch (err) {
        console.error('Admin data fetch failed:', err);
      }
      setLoading(false);
    }
    fetchData();
  }, [user, token, authLoading, router]);

  async function handleCreateBatch(e) {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    try {
      const batch = await createBatch(token, { name: batchName, description: batchDesc });
      setBatches(prev => [...prev, batch]);
      setBatchName('');
      setBatchDesc('');
      setFormSuccess(`Batch "${batch.name}" created!`);
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function handleSendInvite(e) {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    try {
      const invite = await createInvite(token, { email: inviteEmail, batchId: inviteBatchId });
      setInvites(prev => [...prev, invite]);
      setInviteEmail('');
      setFormSuccess(`Invite sent to ${invite.email}!`);
    } catch (err) {
      setFormError(err.message);
    }
  }

  function copyInviteLink(inviteToken) {
    const link = `${window.location.origin}/join?token=${inviteToken}`;
    navigator.clipboard.writeText(link);
    setFormSuccess('Invite link copied to clipboard!');
    setTimeout(() => setFormSuccess(''), 4000);
  }

  if (authLoading || loading) {
    return (
      <div className={styles.page}>
        <div className="container">
          <div className={styles.skeletons}>
            {[1,2,3].map(i => <div key={i} className={`skeleton ${styles.skeletonCard}`} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1>Admin Dashboard</h1>
          <p className="text-secondary">Manage students, batches, and invites</p>
        </div>

        {/* Stats */}
        <div className={styles.statsGrid}>
          <div className={`card ${styles.statCard}`}>
            <div className={styles.statNum}>{dashboard?.totalStudents || 0}</div>
            <div className={styles.statLabel}>Total Students</div>
          </div>
          <div className={`card ${styles.statCard}`}>
            <div className={styles.statNum} style={{ color: 'var(--accent-400)' }}>{dashboard?.activeStudents || 0}</div>
            <div className={styles.statLabel}>Active (7 days)</div>
          </div>
          <div className={`card ${styles.statCard}`}>
            <div className={styles.statNum} style={{ color: 'var(--warning-400)' }}>{dashboard?.inactiveCount || 0}</div>
            <div className={styles.statLabel}>Inactive</div>
          </div>
          <div className={`card ${styles.statCard}`}>
            <div className={styles.statNum} style={{ color: 'var(--primary-400)' }}>{batches.length}</div>
            <div className={styles.statLabel}>Batches</div>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {['overview', 'batches', 'invites'].map(tab => (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {formError && <div className={styles.formError}>{formError}</div>}
        {formSuccess && <div className={styles.formSuccess}>{formSuccess}</div>}

        {/* ─── Overview Tab ─── */}
        {activeTab === 'overview' && dashboard?.students && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Batch</th>
                  <th>Pron</th>
                  <th>Vocab</th>
                  <th>Grammar</th>
                  <th>Overall</th>
                  <th>Streak</th>
                  <th>Last Active</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.students.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div className={styles.studentName}>
                        <div className={styles.studentAvatar}>{s.name?.charAt(0)}</div>
                        <div>
                          <div>{s.name}</div>
                          <div className={styles.studentEmail}>{s.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="badge badge-primary">{s.batchName || '—'}</span></td>
                    <td><span className={`level-badge level-${s.pronunciationLevel}`}>L{s.pronunciationLevel}</span></td>
                    <td><span className={`level-badge level-${s.vocabularyLevel}`}>L{s.vocabularyLevel}</span></td>
                    <td><span className={`level-badge level-${s.grammarLevel}`}>L{s.grammarLevel}</span></td>
                    <td><span className={`level-badge level-${s.overallLevel}`}>L{s.overallLevel}</span></td>
                    <td>{s.practiceStreak || 0}🔥</td>
                    <td className="text-muted text-sm">
                      {s.lastPracticedAt
                        ? new Date(s.lastPracticedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                        : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dashboard.students.length === 0 && (
              <div className={styles.emptyTable}>No students yet. Send invites to get started!</div>
            )}
          </div>
        )}

        {/* ─── Batches Tab ─── */}
        {activeTab === 'batches' && (
          <div className={styles.tabContent}>
            <form onSubmit={handleCreateBatch} className={styles.inlineForm}>
              <div className="input-group">
                <label>Batch Name</label>
                <input className="input" placeholder="e.g. Batch 2026-A" value={batchName}
                  onChange={e => setBatchName(e.target.value)} required />
              </div>
              <div className="input-group">
                <label>Description</label>
                <input className="input" placeholder="Optional description" value={batchDesc}
                  onChange={e => setBatchDesc(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary">Create Batch</button>
            </form>

            <div className={styles.batchList}>
              {batches.map(b => (
                <div key={b.id} className={`card ${styles.batchItem}`}>
                  <div>
                    <div className={styles.batchName}>{b.name}</div>
                    {b.description && <div className="text-muted text-sm">{b.description}</div>}
                  </div>
                  <div className="text-muted text-xs">
                    Created {new Date(b.created_at).toLocaleDateString('en-GB')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Invites Tab ─── */}
        {activeTab === 'invites' && (
          <div className={styles.tabContent}>
            <form onSubmit={handleSendInvite} className={styles.inlineForm}>
              <div className="input-group">
                <label>Student Email</label>
                <input className="input" type="email" placeholder="student@example.com"
                  value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required />
              </div>
              <div className="input-group">
                <label>Assign to Batch</label>
                <select className="input" value={inviteBatchId}
                  onChange={e => setInviteBatchId(e.target.value)} required>
                  <option value="">Select a batch</option>
                  {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <button type="submit" className="btn btn-primary" disabled={batches.length === 0}>
                Send Invite
              </button>
            </form>

            <div className={styles.inviteList}>
              {invites.map(inv => (
                <div key={inv.id} className={`card ${styles.inviteItem}`}>
                  <div>
                    <div>{inv.email}</div>
                    {inv.status === 'pending' && (
                      <button
                        className="btn btn-ghost btn-xs"
                        style={{ marginTop: '6px', fontSize: '0.75rem', padding: '2px 8px', textTransform: 'none' }}
                        onClick={() => copyInviteLink(inv.token)}
                      >
                        Copy Join Link
                      </button>
                    )}
                  </div>
                  <span className={`badge ${
                    inv.status === 'accepted' ? 'badge-accent' : 
                    inv.status === 'expired' ? 'badge-danger' : 'badge-warning'
                  }`}>
                    {inv.status}
                  </span>
                  <div className="text-muted text-xs">
                    {new Date(inv.created_at).toLocaleDateString('en-GB')}
                  </div>
                </div>
              ))}
              {invites.length === 0 && (
                <div className={styles.emptyTable}>No invites sent yet.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
