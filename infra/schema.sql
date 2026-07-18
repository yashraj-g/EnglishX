-- EnglishX Database Schema v1
-- Run this against your PostgreSQL database to create all tables

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('learner', 'admin')),
    batch_id UUID,
    pronunciation_level INT DEFAULT 1 CHECK (pronunciation_level BETWEEN 1 AND 6),
    vocabulary_level INT DEFAULT 1 CHECK (vocabulary_level BETWEEN 1 AND 6),
    grammar_level INT DEFAULT 1 CHECK (grammar_level BETWEEN 1 AND 6),
    overall_level INT DEFAULT 1 CHECK (overall_level BETWEEN 1 AND 6),
    last_practiced_at TIMESTAMPTZ,
    practice_streak INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Batches table
CREATE TABLE IF NOT EXISTS batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    admin_id UUID NOT NULL REFERENCES users(id),
    description VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key to users after batches exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_batch') THEN
        ALTER TABLE users ADD CONSTRAINT fk_users_batch
            FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL;
    END IF;
END $$;


-- Invites table
CREATE TABLE IF NOT EXISTS invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    batch_id UUID NOT NULL REFERENCES batches(id),
    invited_by UUID NOT NULL REFERENCES users(id),
    token UUID UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    mode VARCHAR(30) NOT NULL CHECK (mode IN ('free_talk', 'hr_interview', 'placement')),
    duration_seconds INT,
    turn_count INT DEFAULT 0,
    transcript JSONB DEFAULT '[]'::jsonb,
    audio_url VARCHAR(500),
    audio_keys JSONB DEFAULT '[]'::jsonb,  -- Array of { turnIndex, s3Key } objects
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

-- Feedback Reports table
CREATE TABLE IF NOT EXISTS feedback_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID UNIQUE NOT NULL REFERENCES sessions(id),
    user_id UUID NOT NULL REFERENCES users(id),
    pronunciation_score INT CHECK (pronunciation_score BETWEEN 0 AND 100),
    vocabulary_score INT CHECK (vocabulary_score BETWEEN 0 AND 100),
    grammar_score INT CHECK (grammar_score BETWEEN 0 AND 100),
    overall_score INT CHECK (overall_score BETWEEN 0 AND 100),
    pronunciation_details JSONB DEFAULT '{}'::jsonb,
    vocabulary_details JSONB DEFAULT '{}'::jsonb,
    grammar_details JSONB DEFAULT '{}'::jsonb,
    strengths JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Level History table
CREATE TABLE IF NOT EXISTS level_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    dimension VARCHAR(20) NOT NULL CHECK (dimension IN ('pronunciation', 'vocabulary', 'grammar', 'overall')),
    level INT NOT NULL CHECK (level BETWEEN 1 AND 6),
    score INT NOT NULL CHECK (score BETWEEN 0 AND 100),
    session_id UUID REFERENCES sessions(id),
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Refresh Tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_batch_id ON users(batch_id);
CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_session_id ON feedback_reports(session_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_level_history_user_dimension ON level_history(user_id, dimension);
CREATE INDEX IF NOT EXISTS idx_level_history_recorded_at ON level_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
