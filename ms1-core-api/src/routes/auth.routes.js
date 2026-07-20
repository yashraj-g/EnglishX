const { Router } = require('express');
const authService = require('../services/auth.service');
const { validate } = require('../middleware/validation.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { signupSchema, loginSchema, refreshTokenSchema, sendOtpSchema, verifyOtpSchema } = require('../schemas');

const router = Router();

router.post('/signup', validate(signupSchema), async (req, res) => {
  try {
    const result = await authService.signup(req.validated);
    res.status(201).json(result);
  } catch (err) {
    const status = err.message.includes('Email already registered') ? 409 : 400;
    res.status(status).json({ error: err.message });
  }
});

router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const result = await authService.login(req.validated);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

router.post('/refresh', validate(refreshTokenSchema), async (req, res) => {
  try {
    const result = await authService.refreshAccessToken(req.validated.refreshToken);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

router.get('/profile', authenticate, async (req, res) => {
  try {
    const profile = await authService.getProfile(req.user.id);
    res.json(profile);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// OTP: resend a verification code to the given email
router.post('/send-otp', validate(sendOtpSchema), async (req, res) => {
  try {
    await authService.sendOtp({ email: req.validated.email });
    res.json({ message: 'Verification code sent' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// OTP: verify the 6-digit code — on success, issues JWT access + refresh tokens
router.post('/verify-otp', validate(verifyOtpSchema), async (req, res) => {
  try {
    const result = await authService.verifyOtp(req.validated);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
