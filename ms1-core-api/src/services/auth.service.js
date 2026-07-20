const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const userRepository = require('../repositories/user.repository');
const inviteRepository = require('../repositories/invite.repository');
const levelRepository = require('../repositories/level.repository');
const otpRepository = require('../repositories/otp.repository');
const emailService = require('./email.service');

const SALT_ROUNDS = 12;

const authService = {
  generateAccessToken(user) {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        batchId: user.batch_id,
      },
      config.jwt.accessSecret,
      { expiresIn: config.jwt.accessExpiry }
    );
  },

  generateRefreshToken() {
    return crypto.randomBytes(40).toString('hex');
  },

  async hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
  },

  async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  },

  async signup({ name, email, password, inviteToken }) {
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    let batchId = null;
    let role = 'admin'; // default signup is admin; learners come through invites
    let emailVerified = false;

    if (inviteToken) {
      const invite = await inviteRepository.findByToken(inviteToken);
      if (!invite) {
        throw new Error('Invalid invite token');
      }
      if (invite.status !== 'pending') {
        throw new Error('Invite has already been used or expired');
      }
      if (new Date(invite.expires_at) < new Date()) {
        await inviteRepository.markExpired(invite.id);
        throw new Error('Invite has expired');
      }
      if (invite.email !== email) {
        throw new Error('Email does not match the invite');
      }

      batchId = invite.batch_id;
      role = 'learner';
      emailVerified = true; // invite email is already verified by the admin
      await inviteRepository.markAccepted(invite.id);
    }

    const passwordHash = await this.hashPassword(password);
    const userId = uuidv4();

    const user = await userRepository.create({
      id: userId,
      email,
      passwordHash,
      name,
      role,
      batchId,
      emailVerified,
    });

    // Admin accounts require email verification via OTP before receiving tokens.
    // Learner accounts (invite-based) skip OTP — the invite itself verifies email ownership.
    if (role === 'admin') {
      await this.sendOtp({ email });
      return {
        requiresVerification: true,
        email,
        message: 'A 6-digit verification code has been sent to your email.',
      };
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken();

    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 7);

    await levelRepository.saveRefreshToken({
      id: uuidv4(),
      userId: user.id,
      tokenHash: refreshTokenHash,
      expiresAt: refreshExpiry,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        batchId: user.batch_id,
      },
      accessToken,
      refreshToken,
    };
  },

  async sendOtp({ email }) {
    // Invalidate any previous unused OTPs for this email
    await otpRepository.invalidateAll(email);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    await otpRepository.create({
      id: uuidv4(),
      email,
      otpHash,
      expiresAt,
    });

    await emailService.sendOtpEmail({ to: email, otp });
  },

  async verifyOtp({ email, otp }) {
    const record = await otpRepository.findValid(email);
    if (!record) {
      throw new Error('OTP is invalid or has expired');
    }

    const submittedHash = crypto.createHash('sha256').update(otp).digest('hex');
    if (submittedHash !== record.otp_hash) {
      throw new Error('Incorrect OTP');
    }

    await otpRepository.markUsed(record.id);

    // Mark the user as verified and issue tokens
    const user = await userRepository.findByEmail(email);
    if (!user) throw new Error('User not found');

    await userRepository.markEmailVerified(user.id);

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken();

    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 7);

    await levelRepository.saveRefreshToken({
      id: uuidv4(),
      userId: user.id,
      tokenHash: refreshTokenHash,
      expiresAt: refreshExpiry,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        batchId: user.batch_id,
      },
      accessToken,
      refreshToken,
    };
  },

  async login({ email, password }) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    const validPassword = await this.comparePassword(password, user.password_hash);
    if (!validPassword) {
      throw new Error('Invalid email or password');
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken();

    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 7);

    await levelRepository.saveRefreshToken({
      id: uuidv4(),
      userId: user.id,
      tokenHash: refreshTokenHash,
      expiresAt: refreshExpiry,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        batchId: user.batch_id,
        pronunciationLevel: user.pronunciation_level,
        vocabularyLevel: user.vocabulary_level,
        grammarLevel: user.grammar_level,
        overallLevel: user.overall_level,
      },
      accessToken,
      refreshToken,
    };
  },

  async refreshAccessToken(refreshToken) {
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const storedToken = await levelRepository.findRefreshToken(tokenHash);
    if (!storedToken) {
      throw new Error('Invalid or expired refresh token');
    }

    const user = await userRepository.findById(storedToken.user_id);
    if (!user) {
      throw new Error('User not found');
    }

    // Rotate: revoke old, issue new
    await levelRepository.revokeRefreshToken(storedToken.id);

    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = this.generateRefreshToken();

    const newRefreshTokenHash = crypto
      .createHash('sha256')
      .update(newRefreshToken)
      .digest('hex');

    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 7);

    await levelRepository.saveRefreshToken({
      id: uuidv4(),
      userId: user.id,
      tokenHash: newRefreshTokenHash,
      expiresAt: refreshExpiry,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  },

  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw new Error('User not found');

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      batchId: user.batch_id,
      pronunciationLevel: user.pronunciation_level,
      vocabularyLevel: user.vocabulary_level,
      grammarLevel: user.grammar_level,
      overallLevel: user.overall_level,
      lastPracticedAt: user.last_practiced_at,
      practiceStreak: user.practice_streak,
      createdAt: user.created_at,
    };
  },
};

module.exports = authService;
