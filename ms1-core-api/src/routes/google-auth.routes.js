const { Router } = require('express');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const config = require('../config');
const userRepository = require('../repositories/user.repository');
const levelRepository = require('../repositories/level.repository');
const authService = require('../services/auth.service');

const router = Router();

const isGoogleConfigured = config.google.clientId && config.google.clientId !== '';

if (isGoogleConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.callbackUrl,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error('No email from Google profile'));

          let user = await userRepository.findByEmail(email);

          if (!user) {
            const userId = uuidv4();
            user = await userRepository.create({
              id: userId,
              email,
              passwordHash: crypto.randomBytes(32).toString('hex'),
              name: profile.displayName || email.split('@')[0],
              role: 'admin',
              batchId: null,
            });
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
}

router.get(
  '/google',
  (req, res, next) => {
    if (!isGoogleConfigured) {
      return res.status(501).json({ error: 'Google OAuth is not configured on this server' });
    }
    next();
  },
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get(
  '/google/callback',
  (req, res, next) => {
    if (!isGoogleConfigured) {
      return res.status(501).json({ error: 'Google OAuth is not configured on this server' });
    }
    next();
  },
  passport.authenticate('google', { session: false, failureRedirect: `${config.frontend.url}/login?error=oauth_failed` }),
  async (req, res) => {
    try {
      const user = req.user;
      const jwtAccessToken = authService.generateAccessToken(user);
      const refreshToken = authService.generateRefreshToken();

      const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const refreshExpiry = new Date();
      refreshExpiry.setDate(refreshExpiry.getDate() + 7);

      await levelRepository.saveRefreshToken({
        id: uuidv4(),
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: refreshExpiry,
      });

      const redirectUrl = new URL(`${config.frontend.url}/auth/callback`);
      redirectUrl.searchParams.set('accessToken', jwtAccessToken);
      redirectUrl.searchParams.set('refreshToken', refreshToken);
      redirectUrl.searchParams.set('role', user.role);

      res.redirect(redirectUrl.toString());
    } catch (err) {
      console.error('Google OAuth callback error:', err);
      res.redirect(`${config.frontend.url}/login?error=oauth_failed`);
    }
  }
);

module.exports = { router, passport };
