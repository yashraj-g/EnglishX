const { query } = require('../config/database');

const otpRepository = {
  async create({ id, email, otpHash, expiresAt }) {
    await query(
      `INSERT INTO email_otps (id, email, otp_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [id, email, otpHash, expiresAt]
    );
  },

  // Find the latest unused, unexpired OTP for this email
  async findValid(email) {
    const result = await query(
      `SELECT * FROM email_otps
       WHERE email = $1 AND used = false AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );
    return result.rows[0] || null;
  },

  async markUsed(id) {
    await query('UPDATE email_otps SET used = true WHERE id = $1', [id]);
  },

  // Clean up stale OTPs for an email before issuing a new one
  async invalidateAll(email) {
    await query(
      "UPDATE email_otps SET used = true WHERE email = $1 AND used = false",
      [email]
    );
  },
};

module.exports = otpRepository;
