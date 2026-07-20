const { Pool } = require('pg');
const config = require('./index');

const pool = new Pool({
  connectionString: config.db.url,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

async function initDb() {
  if (!config.db.url) return;
  try {
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
      CREATE TABLE IF NOT EXISTS email_otps (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email VARCHAR(255) NOT NULL,
          otp_hash VARCHAR(255) NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          used BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_email_otps_email ON email_otps(email);
      CREATE INDEX IF NOT EXISTS idx_email_otps_expires ON email_otps(expires_at);
    `);
    console.log('[DB] Auto-migration complete: email_verified & email_otps ensured.');
  } catch (err) {
    console.warn('[DB] Auto-migration skipped or failed:', err.message);
  }
}

if (config.nodeEnv !== 'test') {
  initDb();
}

const query = (text, params) => pool.query(text, params);
const getClient = () => pool.connect();

module.exports = { pool, query, getClient, initDb };

