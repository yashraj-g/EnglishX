-- Migration 002: OTP-based email verification
-- Run this against the database after schema.sql (migration 001)

-- Add email_verified flag to users (admins start unverified; learners verified by invite flow)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- Mark all existing learners as verified (they joined via invite, which already verifies intent)
UPDATE users SET email_verified = true WHERE role = 'learner';

-- OTP table: one-time codes for email verification
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
