const { query } = require('../config/database');

const sessionRepository = {
  async create({ id, userId, mode }) {
    const result = await query(
      `INSERT INTO sessions (id, user_id, mode, started_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [id, userId, mode]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await query(
      'SELECT *, COALESCE(audio_keys, \'[]\') AS audio_keys FROM sessions WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Append a { turnIndex, s3Key } entry to the session's audio_keys JSONB array.
   * Safe to call concurrently — uses jsonb_insert for atomic append.
   */
  async addAudioKey(sessionId, turnIndex, s3Key) {
    const entry = JSON.stringify({ turnIndex, s3Key });
    const result = await query(
      `UPDATE sessions
       SET audio_keys = COALESCE(audio_keys, '[]'::jsonb) || $2::jsonb
       WHERE id = $1
       RETURNING id, audio_keys`,
      [sessionId, entry]
    );
    return result.rows[0];
  },

  async endSession(id, { durationSeconds, turnCount, transcript, audioUrl }) {
    const result = await query(
      `UPDATE sessions 
       SET duration_seconds = $2, turn_count = $3, transcript = $4, audio_url = $5, ended_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, durationSeconds, turnCount, JSON.stringify(transcript), audioUrl || null]
    );
    return result.rows[0];
  },

  async addTurn(sessionId, turn) {
    const result = await query(
      `UPDATE sessions 
       SET transcript = COALESCE(transcript, '[]'::jsonb) || $2::jsonb,
           turn_count = COALESCE(turn_count, 0) + 1
       WHERE id = $1
       RETURNING *`,
      [sessionId, JSON.stringify(turn)]
    );
    return result.rows[0];
  },

  async findByUserId(userId, limit = 20) {
    const result = await query(
      `SELECT s.*, fr.pronunciation_score, fr.vocabulary_score, fr.grammar_score, fr.overall_score
       FROM sessions s
       LEFT JOIN feedback_reports fr ON fr.session_id = s.id
       WHERE s.user_id = $1
       ORDER BY s.started_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  },

  async findRecentByUserId(userId, limit = 5) {
    const result = await query(
      `SELECT s.id, s.mode, s.duration_seconds, s.turn_count, s.started_at,
              fr.pronunciation_score, fr.vocabulary_score, fr.grammar_score, fr.overall_score
       FROM sessions s
       LEFT JOIN feedback_reports fr ON fr.session_id = s.id
       WHERE s.user_id = $1 AND s.ended_at IS NOT NULL
       ORDER BY s.started_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  },
};

module.exports = sessionRepository;
