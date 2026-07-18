'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const sessionService = require('../services/session.service');
const audioService = require('../services/audio.service');
const sessionRepository = require('../repositories/session.repository');

const router = Router();

/**
 * GET /api/sessions/:id/audio
 *
 * Returns 1-hour presigned S3 URLs for all audio turns recorded in a session.
 * Only the session owner can access their recordings.
 *
 * Response:
 * {
 *   sessionId: string,
 *   turns: [
 *     { turnIndex: number, s3Key: string, presignedUrl: string | null }
 *   ]
 * }
 */
router.get('/:id/audio', authenticate, async (req, res) => {
  try {
    const session = await sessionService.getSessionById(req.params.id);

    if (session.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your session' });
    }

    // audio_keys is a JSONB array: [{ turnIndex, s3Key }, ...]
    const audioKeys = session.audio_keys || [];

    if (audioKeys.length === 0) {
      return res.json({ sessionId: req.params.id, turns: [] });
    }

    const turns = await audioService.getSessionAudioUrls(audioKeys);

    return res.json({ sessionId: req.params.id, turns });
  } catch (err) {
    if (err.message === 'Session not found') {
      return res.status(404).json({ error: err.message });
    }
    console.error('[AudioRoutes] Error fetching audio URLs:', err);
    return res.status(500).json({ error: 'Failed to generate audio URLs' });
  }
});

/**
 * POST /api/sessions/:id/audio-key
 *
 * Called by ms2-speech-agent (or the frontend) after a turn to register
 * a new S3 key in the session's audio_keys list.
 *
 * Body: { turnIndex: number, s3Key: string }
 *
 * Note: In the current architecture ms2 returns the s3Key to the frontend
 * which then calls this endpoint. This keeps S3 knowledge out of ms1.
 */
router.post('/:id/audio-key', authenticate, async (req, res) => {
  try {
    const session = await sessionService.getSessionById(req.params.id);

    if (session.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your session' });
    }

    const { turnIndex, s3Key } = req.body;

    if (typeof turnIndex !== 'number' || !s3Key || typeof s3Key !== 'string') {
      return res.status(400).json({ error: 'turnIndex (number) and s3Key (string) are required' });
    }

    await sessionRepository.addAudioKey(req.params.id, turnIndex, s3Key);
    return res.json({ success: true });
  } catch (err) {
    if (err.message === 'Session not found') {
      return res.status(404).json({ error: err.message });
    }
    console.error('[AudioRoutes] Error adding audio key:', err);
    return res.status(500).json({ error: 'Failed to register audio key' });
  }
});

module.exports = router;
