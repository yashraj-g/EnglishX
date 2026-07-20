const { query } = require('../config/database');

const userRepository = {
  async create({ id, email, passwordHash, name, role, batchId, emailVerified = false }) {
    const result = await query(
      `INSERT INTO users (id, email, password_hash, name, role, batch_id, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, name, role, batch_id, pronunciation_level, vocabulary_level, grammar_level, overall_level, created_at`,
      [id, email, passwordHash, name, role, batchId || null, emailVerified]
    );
    return result.rows[0];
  },

  async findByEmail(email) {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  },

  async findById(id) {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async updateLevels(userId, { pronunciationLevel, vocabularyLevel, grammarLevel, overallLevel }) {
    const result = await query(
      `UPDATE users 
       SET pronunciation_level = $2, vocabulary_level = $3, grammar_level = $4, overall_level = $5, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [userId, pronunciationLevel, vocabularyLevel, grammarLevel, overallLevel]
    );
    return result.rows[0];
  },

  async updateLastPracticed(userId) {
    await query(
      'UPDATE users SET last_practiced_at = NOW(), updated_at = NOW() WHERE id = $1',
      [userId]
    );
  },

  async markEmailVerified(userId) {
    await query(
      'UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1',
      [userId]
    );
  },

  async updateStreak(userId, streak) {
    await query(
      'UPDATE users SET practice_streak = $2, updated_at = NOW() WHERE id = $1',
      [userId, streak]
    );
  },

  async findByBatchId(batchId) {
    const result = await query(
      `SELECT id, email, name, pronunciation_level, vocabulary_level, grammar_level, 
              overall_level, last_practiced_at, practice_streak, is_active, created_at
       FROM users WHERE batch_id = $1 AND role = 'learner'
       ORDER BY name`,
      [batchId]
    );
    return result.rows;
  },

  async findAllLearners() {
    const result = await query(
      `SELECT u.id, u.email, u.name, u.pronunciation_level, u.vocabulary_level, 
              u.grammar_level, u.overall_level, u.last_practiced_at, u.practice_streak, 
              u.is_active, u.created_at, b.name as batch_name, u.batch_id
       FROM users u
       LEFT JOIN batches b ON u.batch_id = b.id
       WHERE u.role = 'learner'
       ORDER BY u.name`
    );
    return result.rows;
  },

  async findUsersNotPracticedToday() {
    const result = await query(
      `SELECT id, email, name FROM users 
       WHERE role = 'learner' AND is_active = true
       AND (last_practiced_at IS NULL OR last_practiced_at < CURRENT_DATE)
       ORDER BY name`
    );
    return result.rows;
  },
};

module.exports = userRepository;
