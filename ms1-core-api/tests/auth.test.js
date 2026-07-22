/**
 * Integration tests — Custom Auth
 *
 * Covers: signup, login, protected route access, token refresh.
 * Database and SES are mocked (see tests/setup.js).
 */
require('./setup');

const request = require('supertest');
const app = require('../src/app');
const { resetStores } = require('./setup');

// Reset in-memory stores before each test for isolation
beforeEach(() => resetStores());

// ── Signup ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/signup', () => {
  it('creates an admin account and issues tokens', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Meera Coach', email: 'meera@zenith.com', password: 'Admin1234' });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.role).toBe('admin');
  });

  it('rejects signup when password is shorter than 8 chars', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Test', email: 'test@x.com', password: 'short' });

    expect(res.status).toBe(400);
  });

  it('rejects duplicate email on second signup', async () => {
    const { getStores } = require('./setup');
    const { _users } = getStores();
    _users.push({
      id: 'u-1',
      email: 'admin@test.com',
      password_hash: 'hash',
      name: 'Admin One',
      role: 'admin',
      email_verified: true,
    });

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Admin Two', email: 'admin@test.com', password: 'Password2' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already registered/i);
  });
});

// ── OTP Verify ────────────────────────────────────────────────────────────────

describe('POST /api/auth/verify-otp', () => {
  it('wrong OTP returns 400', async () => {
    // Sign up to trigger OTP creation
    await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Rohit', email: 'rohit@test.com', password: 'Password1' });

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'rohit@test.com', otp: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid|expired|incorrect/i);
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('issues tokens on valid credentials', async () => {
    // Create a verified user in the store directly via signup + OTP shortcut
    // We use the invite-based (learner) path which bypasses OTP
    const { getStores } = require('./setup');
    const crypto = require('crypto');
    const bcrypt = require('bcryptjs');
    const { v4: uuidv4 } = require('uuid');
    const { query } = require('../src/config/database');

    // Manually insert a pre-verified user
    const hash = await bcrypt.hash('MyPassword1', 12);
    const userId = uuidv4();
    const { _users } = getStores();
    _users.push({
      id: userId,
      email: 'verified@test.com',
      password_hash: hash,
      name: 'Test User',
      role: 'admin',
      batch_id: null,
      email_verified: true,
      pronunciation_level: 1, vocabulary_level: 1,
      grammar_level: 1, overall_level: 1,
      last_practiced_at: null, practice_streak: 0,
      is_active: true,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'verified@test.com', password: 'MyPassword1' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('rejects invalid credentials with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'WrongPass' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it('rejects missing fields with 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'only@email.com' });

    expect(res.status).toBe(400);
  });
});

// ── Protected Route ───────────────────────────────────────────────────────────

describe('GET /api/auth/profile', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/profile');
    expect(res.status).toBe(401);
  });

  it('returns 401 with a malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', 'Bearer not.a.real.token');

    expect(res.status).toBe(401);
  });

  it('returns profile with a valid JWT', async () => {
    const jwt = require('jsonwebtoken');
    const config = require('../src/config');
    const { _users } = require('./setup').getStores();

    // Push a user into the in-memory store
    const userId = require('uuid').v4();
    _users.push({
      id: userId, email: 'profile@test.com', password_hash: 'x',
      name: 'Profile User', role: 'learner', batch_id: null,
      pronunciation_level: 2, vocabulary_level: 3, grammar_level: 2, overall_level: 2,
      last_practiced_at: null, practice_streak: 0,
    });

    const token = jwt.sign(
      { sub: userId, email: 'profile@test.com', role: 'learner' },
      config.jwt.accessSecret,
      { expiresIn: '15m' }
    );

    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('profile@test.com');
    expect(res.body.role).toBe('learner');
  });
});

// ── Token Refresh ─────────────────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
  it('rejects an invalid refresh token with 401', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'completely-invalid-token' });

    expect(res.status).toBe(401);
  });
});
