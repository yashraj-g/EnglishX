const API_BASE = '/api';
const SPEECH_BASE = '/speech';

function getHeaders(token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function request(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || data.detail || 'Request failed');
    error.status = res.status;
    throw error;
  }
  return data;
}

// ─── Auth ────────────────────────────────
export async function signup({ name, email, password, inviteToken }) {
  return request(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ name, email, password, inviteToken }),
  });
}

export async function login({ email, password }) {
  return request(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ email, password }),
  });
}

export async function refreshToken(refreshTokenStr) {
  return request(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ refreshToken: refreshTokenStr }),
  });
}

export async function getProfile(token) {
  return request(`${API_BASE}/auth/profile`, {
    headers: getHeaders(token),
  });
}

// ─── Batches ─────────────────────────────
export async function createBatch(token, { name, description }) {
  return request(`${API_BASE}/batches`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ name, description }),
  });
}

export async function getBatches(token) {
  return request(`${API_BASE}/batches`, {
    headers: getHeaders(token),
  });
}

// ─── Invites ─────────────────────────────
export async function createInvite(token, { email, batchId }) {
  return request(`${API_BASE}/invites`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ email, batchId }),
  });
}

export async function getInvites(token) {
  return request(`${API_BASE}/invites`, {
    headers: getHeaders(token),
  });
}

export async function validateInvite(inviteToken) {
  return request(`${API_BASE}/invites/validate/${inviteToken}`);
}

// ─── Sessions ────────────────────────────
export async function startSession(token, { mode }) {
  return request(`${API_BASE}/sessions/start`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ mode }),
  });
}

export async function endSession(token, sessionId, data) {
  return request(`${API_BASE}/sessions/${sessionId}/end`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(data),
  });
}

export async function getSessionFeedback(token, sessionId) {
  return request(`${API_BASE}/sessions/${sessionId}/feedback`, {
    headers: getHeaders(token),
  });
}

export async function saveSessionFeedback(token, sessionId, feedbackData) {
  return request(`${API_BASE}/sessions/${sessionId}/feedback`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(feedbackData),
  });
}

export async function getSessionHistory(token, limit = 20) {
  return request(`${API_BASE}/sessions/history?limit=${limit}`, {
    headers: getHeaders(token),
  });
}

// ─── Dashboard ───────────────────────────
export async function getLearnerDashboard(token) {
  return request(`${API_BASE}/dashboard/learner`, {
    headers: getHeaders(token),
  });
}

export async function getAdminDashboard(token) {
  return request(`${API_BASE}/dashboard/admin`, {
    headers: getHeaders(token),
  });
}

export async function getLevelTrend(token, dimension) {
  return request(`${API_BASE}/dashboard/levels/trend/${dimension}`, {
    headers: getHeaders(token),
  });
}

// ─── Speech (ms2) ────────────────────────
export async function processTurn({ sessionId, audioBase64, textInput, mode, learnerLevel, conversationHistory, userId, turnIndex }) {
  return request(`${SPEECH_BASE}/turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      audio_base64: audioBase64 || null,
      text_input: textInput || null,
      mode,
      learner_level: learnerLevel,
      conversation_history: conversationHistory,
      user_id: userId || null,
      turn_index: turnIndex || 0,
    }),
  });
}

export async function analyzeSession({ sessionId, transcript, mode, learnerLevel }) {
  return request(`${SPEECH_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      transcript,
      mode,
      learner_level: learnerLevel,
    }),
  });
}

// ─── Audio Playback ───────────────────────
/**
 * Fetch presigned S3 URLs for all recorded turns in a session.
 * Returns { sessionId, turns: [{ turnIndex, s3Key, presignedUrl }] }
 */
export async function getSessionAudio(token, sessionId) {
  return request(`${API_BASE}/sessions/${sessionId}/audio`, {
    headers: getHeaders(token),
  });
}

/**
 * Register an S3 audio key for a turn in ms1.
 * Called after processTurn returns an audio_s3_key.
 */
export async function registerAudioKey(token, sessionId, turnIndex, s3Key) {
  return request(`${API_BASE}/sessions/${sessionId}/audio-key`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ turnIndex, s3Key }),
  });
}
