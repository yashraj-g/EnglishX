/**
 * Test setup: mocks the database so integration tests run without a real Postgres
 * instance and mock SES so emails are never sent during tests.
 *
 * Each test gets a fresh in-memory user/invite/otp store.
 */

// ── In-memory stores ──────────────────────────────────────────────────────────
let _users = [];
let _invites = [];
let _otps = [];
let _refreshTokens = [];
let _levelHistory = [];
let _feedbackReports = [];

function resetStores() {
  _users = [];
  _invites = [];
  _otps = [];
  _refreshTokens = [];
  _levelHistory = [];
  _feedbackReports = [];
}

// ── Database mock ─────────────────────────────────────────────────────────────
jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  pool: { connect: jest.fn(), end: jest.fn() },
  getClient: jest.fn(),
}));

// ── UUID mock (fix Jest ESM issue with uuid v14) ──────────────────────────────
jest.mock('uuid', () => {
  const crypto = require('crypto');
  return {
    v4: () => crypto.randomUUID(),
  };
});

// ── Email mock (no real SES) ──────────────────────────────────────────────────
jest.mock('../src/services/email.service', () => ({
  sendInviteEmail: jest.fn().mockResolvedValue({ messageId: 'mock', status: 'mocked' }),
  sendDailyReminder: jest.fn().mockResolvedValue({ messageId: 'mock', status: 'mocked' }),
  sendOtpEmail: jest.fn().mockResolvedValue({ messageId: 'mock', status: 'mocked' }),
}));

// ── Wire database mock to in-memory stores ─────────────────────────────────────
const { query } = require('../src/config/database');

query.mockImplementation(async (sql, params = []) => {
  const s = sql.trim().toUpperCase();

  // ── users ──────────────────────────────────────────────
  if (s.startsWith('INSERT INTO USERS')) {
    const [id, email, passwordHash, name, role, batchId, emailVerified = false] = params;
    const row = {
      id, email, password_hash: passwordHash, name, role,
      batch_id: batchId || null,
      email_verified: emailVerified,
      pronunciation_level: 1, vocabulary_level: 1,
      grammar_level: 1, overall_level: 1,
      last_practiced_at: null, practice_streak: 0,
      is_active: true, created_at: new Date().toISOString(),
    };
    _users.push(row);
    return { rows: [row] };
  }

  if (s.includes('FROM USERS WHERE EMAIL')) {
    return { rows: _users.filter(u => u.email === params[0]) };
  }

  if (s.includes('FROM USERS WHERE ID')) {
    return { rows: _users.filter(u => u.id === params[0]) };
  }

  if (s.includes("UPDATE USERS SET EMAIL_VERIFIED")) {
    _users = _users.map(u => u.id === params[0] ? { ...u, email_verified: true } : u);
    return { rows: [] };
  }

  if (s.includes("UPDATE USERS SET LAST_PRACTICED")) {
    return { rows: [] };
  }

  // ── invites ────────────────────────────────────────────
  if (s.startsWith('INSERT INTO INVITES')) {
    const [id, email, batchId, invitedBy, token, expiresAt] = params;
    const row = {
      id, email, batch_id: batchId, invited_by: invitedBy,
      token, status: 'pending', expires_at: expiresAt, created_at: new Date().toISOString(),
    };
    _invites.push(row);
    return { rows: [row] };
  }

  if (s.includes('FROM INVITES WHERE TOKEN')) {
    return { rows: _invites.filter(i => i.token === params[0]) };
  }

  if (s.includes('FROM INVITES WHERE EMAIL')) {
    return { rows: _invites.filter(i => i.email === params[0]) };
  }

  if (s.includes("UPDATE INVITES SET STATUS = 'ACCEPTED'")) {
    _invites = _invites.map(i => i.id === params[0] ? { ...i, status: 'accepted' } : i);
    return { rows: [] };
  }

  if (s.includes("UPDATE INVITES SET STATUS = 'EXPIRED'")) {
    _invites = _invites.map(i => i.id === params[0] ? { ...i, status: 'expired' } : i);
    return { rows: [] };
  }

  // ── refresh_tokens ─────────────────────────────────────
  if (s.startsWith('INSERT INTO REFRESH_TOKENS')) {
    const [id, userId, tokenHash, expiresAt] = params;
    _refreshTokens.push({ id, user_id: userId, token_hash: tokenHash, expires_at: expiresAt, is_revoked: false });
    return { rows: [] };
  }

  if (s.includes('FROM REFRESH_TOKENS') && s.includes('TOKEN_HASH')) {
    return { rows: _refreshTokens.filter(t => t.token_hash === params[0] && !t.is_revoked) };
  }

  if (s.includes('UPDATE REFRESH_TOKENS SET IS_REVOKED')) {
    _refreshTokens = _refreshTokens.map(t => t.id === params[0] ? { ...t, is_revoked: true } : t);
    return { rows: [] };
  }

  // ── email_otps ─────────────────────────────────────────
  if (s.startsWith('INSERT INTO EMAIL_OTPS')) {
    const [id, email, otpHash, expiresAt] = params;
    _otps.push({ id, email, otp_hash: otpHash, expires_at: expiresAt, used: false });
    return { rows: [] };
  }

  if (s.includes('FROM EMAIL_OTPS') && s.includes('USED = FALSE')) {
    const now = new Date();
    return {
      rows: _otps.filter(o => o.email === params[0] && !o.used && new Date(o.expires_at) > now)
    };
  }

  if (s.includes('UPDATE EMAIL_OTPS SET USED = TRUE WHERE ID')) {
    _otps = _otps.map(o => o.id === params[0] ? { ...o, used: true } : o);
    return { rows: [] };
  }

  if (s.includes('UPDATE EMAIL_OTPS SET USED = TRUE WHERE EMAIL')) {
    _otps = _otps.map(o => o.email === params[0] ? { ...o, used: true } : o);
    return { rows: [] };
  }

  // ── level_history ──────────────────────────────────────
  if (s.startsWith('INSERT INTO LEVEL_HISTORY')) {
    return { rows: [] };
  }

  if (s.includes('FROM LEVEL_HISTORY')) {
    return { rows: [] };
  }

  // fallback
  return { rows: [] };
});

module.exports = { resetStores, getStores: () => ({ _users, _invites, _otps, _refreshTokens }) };
