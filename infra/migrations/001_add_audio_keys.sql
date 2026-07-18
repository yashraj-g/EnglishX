-- Migration: Add audio_keys column to sessions table
-- Run this on your existing database if you already have sessions created.
-- Safe to run multiple times (idempotent via IF NOT EXISTS check).

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'sessions'
          AND column_name = 'audio_keys'
    ) THEN
        ALTER TABLE sessions
            ADD COLUMN audio_keys JSONB DEFAULT '[]'::jsonb;

        COMMENT ON COLUMN sessions.audio_keys IS
            'Array of { turnIndex: number, s3Key: string } objects — S3 keys for per-turn audio recordings';
    END IF;
END $$;
