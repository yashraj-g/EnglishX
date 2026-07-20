/**
 * Integration tests — Invite Flow
 *
 * Covers: admin creates invite, role enforcement, token validation,
 * and invite-based learner signup that binds the user to a batch.
 *
 * Database and SES are mocked (see tests/setup.js).
 */
require('./setup');

const request = require('supertest');
const app = require('../src/app');
const { resetStores, getStores } = require('./setup');
const jwt = require('jsonwebtoken');
const config = require('../src/config');
const { v4: uuidv4 } = require('uuid');

// Reusable admin JWT
function makeAdminToken(userId = uuidv4()) {
  return jwt.sign(
    { sub: userId, email: 'admin@zenith.com', role: 'admin' },
    config.jwt.accessSecret,
    { expiresIn: '15m' }
  );
}

function makeLearnerToken(userId = uuidv4()) {
  return jwt.sign(
    { sub: userId, email: 'learner@zenith.com', role: 'learner' },
    config.jwt.accessSecret,
    { expiresIn: '15m' }
  );
}

// Seed a batch into the in-memory store via the batch repository mock
function seedBatch(adminId) {
  const batchId = uuidv4();
  // The batch.repository calls query() with INSERT INTO batches
  // We'll push it directly into the invites logic by overriding the query mock
  // for batch lookups.
  const { query } = require('../src/config/database');
  const originalImpl = query.getMockImplementation();

  // Extend the mock to return this batch for findById queries
  query.mockImplementation(async (sql, params = []) => {
    const s = sql.trim().toUpperCase();
    if (s.includes('FROM BATCHES WHERE ID') && params[0] === batchId) {
      return { rows: [{ id: batchId, name: 'Comm-B7', admin_id: adminId, description: null }] };
    }
    // Fall through to original mock
    return originalImpl(sql, params);
  });

  return batchId;
}

beforeEach(() => {
  resetStores();
  // Restore the original mock implementation after each test
  jest.restoreAllMocks();
});

// ── Create Invite ─────────────────────────────────────────────────────────────

describe('POST /api/invites', () => {
  it('admin can create an invite — SES email sent, invite stored', async () => {
    const adminId = uuidv4();
    const batchId = seedBatch(adminId);
    const token = makeAdminToken(adminId);

    const res = await request(app)
      .post('/api/invites')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'student@example.com', batchId });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('student@example.com');
    expect(res.body.status).toBe('pending');
    expect(res.body.token).toBeDefined();

    // Verify SES was called
    const emailService = require('../src/services/email.service');
    expect(emailService.sendInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'student@example.com' })
    );
  });

  it('learner cannot create an invite — 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/invites')
      .set('Authorization', `Bearer ${makeLearnerToken()}`)
      .send({ email: 'other@example.com', batchId: uuidv4() });

    expect(res.status).toBe(403);
  });

  it('unauthenticated request returns 401', async () => {
    const res = await request(app)
      .post('/api/invites')
      .send({ email: 'noauth@example.com', batchId: uuidv4() });

    expect(res.status).toBe(401);
  });
});

// ── Validate Invite Token ─────────────────────────────────────────────────────

describe('GET /api/invites/validate/:token', () => {
  it('valid pending invite returns email and batchId', async () => {
    // Directly seed an invite into the store
    const { _invites } = getStores();
    const inviteToken = uuidv4();
    const batchId = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    _invites.push({
      id: uuidv4(),
      email: 'learner@example.com',
      batch_id: batchId,
      invited_by: uuidv4(),
      token: inviteToken,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    });

    const res = await request(app)
      .get(`/api/invites/validate/${inviteToken}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('learner@example.com');
    expect(res.body.batchId).toBe(batchId);
    expect(res.body.status).toBe('pending');
  });

  it('non-existent token returns 400', async () => {
    const res = await request(app)
      .get(`/api/invites/validate/${uuidv4()}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid invite token/i);
  });

  it('expired invite returns 400', async () => {
    const { _invites } = getStores();
    const inviteToken = uuidv4();
    _invites.push({
      id: uuidv4(),
      email: 'expired@example.com',
      batch_id: uuidv4(),
      invited_by: uuidv4(),
      token: inviteToken,
      status: 'pending',
      expires_at: new Date(Date.now() - 1000).toISOString(), // already expired
    });

    const res = await request(app)
      .get(`/api/invites/validate/${inviteToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/expired/i);
  });
});

// ── Invite-based Learner Signup ───────────────────────────────────────────────

describe('POST /api/auth/signup with invite token', () => {
  it('learner signup via valid invite binds user to batch and issues tokens immediately', async () => {
    const { _invites } = getStores();
    const inviteToken = uuidv4();
    const batchId = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    _invites.push({
      id: uuidv4(),
      email: 'newlearner@example.com',
      batch_id: batchId,
      invited_by: uuidv4(),
      token: inviteToken,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    });

    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Rohit Kumar',
        email: 'newlearner@example.com',
        password: 'Learner1234',
        inviteToken,
      });

    expect(res.status).toBe(201);
    // Learner invite-based signup skips OTP — tokens issued immediately
    expect(res.body.requiresVerification).toBeUndefined();
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.role).toBe('learner');
    expect(res.body.user.batchId).toBe(batchId);

    // Verify invite is now marked accepted
    const invite = getStores()._invites.find(i => i.token === inviteToken);
    expect(invite.status).toBe('accepted');
  });

  it('signup with already-used invite returns 400', async () => {
    const { _invites } = getStores();
    const inviteToken = uuidv4();
    _invites.push({
      id: uuidv4(),
      email: 'used@example.com',
      batch_id: uuidv4(),
      invited_by: uuidv4(),
      token: inviteToken,
      status: 'accepted', // already used
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'John Doe', email: 'used@example.com', password: 'Password1', inviteToken });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/used|expired/i);
  });

  it('signup with mismatched email and invite returns 400', async () => {
    const { _invites } = getStores();
    const inviteToken = uuidv4();
    _invites.push({
      id: uuidv4(),
      email: 'intended@example.com',
      batch_id: uuidv4(),
      invited_by: uuidv4(),
      token: inviteToken,
      status: 'pending',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Hacker', email: 'different@example.com', password: 'Password1', inviteToken });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/does not match/i);
  });
});
