const { z } = require('zod');

const signupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  inviteToken: z.string().uuid().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

const inviteSchema = z.object({
  email: z.string().email(),
  batchId: z.string().uuid(),
});

const batchSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
});

const startSessionSchema = z.object({
  mode: z.enum(['free_talk', 'hr_interview', 'placement']),
});

const endSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

const sendOtpSchema = z.object({
  email: z.string().email(),
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6).regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

module.exports = {
  signupSchema,
  loginSchema,
  refreshTokenSchema,
  inviteSchema,
  batchSchema,
  startSessionSchema,
  endSessionSchema,
  sendOtpSchema,
  verifyOtpSchema,
};
