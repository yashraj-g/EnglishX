'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { sendOtp } from '@/lib/api';
import styles from './auth.module.css';

export default function LoginPage() {
  const { login, confirmOtp } = useAuth();
  const router = useRouter();

  // Login Mode: 'password' | 'otp'
  const [mode, setMode] = useState('password');

  // Form inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP flow state
  const [otpStep, setOtpStep] = useState('email'); // 'email' | 'code'
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resendSuccess, setResendSuccess] = useState(false);
  const otpRefs = useRef([]);

  // ── Mode 1: Password Login ─────────────────────
  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result?.role) {
        router.push(result.role === 'admin' ? '/admin' : '/dashboard');
      } else if (result?.user?.role) {
        router.push(result.user.role === 'admin' ? '/admin' : '/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Login failed');
    }
    setLoading(false);
  }

  // ── Mode 2: OTP Login (Step 1: Request OTP) ───
  async function handleRequestOtp(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await sendOtp({ email });
      setOtpStep('code');
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 4000);
    } catch (err) {
      setError(err.message || 'Failed to send OTP');
    }
    setLoading(false);
  }

  // ── Mode 2: OTP Login (Step 2: Verify OTP) ────
  function handleOtpChange(index, value) {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError('');
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Enter all 6 digits');
      return;
    }
    setLoading(true);
    try {
      const result = await confirmOtp({ email, otp: code });
      router.push(result.user?.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.message || 'Verification failed');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    }
    setLoading(false);
  }

  function handleGoogleLogin() {
    window.location.href = '/api/auth/google';
  }

  return (
    <div className={styles.authPage}>
      <div className={styles.authCard}>
        <div className={styles.authHeader}>
          <h1>Welcome back</h1>
          <p>Sign in to continue your speaking journey</p>
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className={styles.googleButton}
          id="google-signin-btn"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Continue with Google
        </button>

        <div className={styles.divider}>
          <span>or</span>
        </div>

        {/* Dual Sign-In Options (Password vs OTP) */}
        <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '10px', padding: '4px', marginBottom: '20px' }}>
          <button
            type="button"
            onClick={() => { setMode('password'); setError(''); }}
            style={{
              flex: 1,
              padding: '10px 14px',
              border: 'none',
              borderRadius: '8px',
              background: mode === 'password' ? '#6366f1' : 'transparent',
              color: mode === 'password' ? '#ffffff' : '#94a3b8',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            🔑 Sign in with Password
          </button>
          <button
            type="button"
            onClick={() => { setMode('otp'); setOtpStep('email'); setError(''); }}
            style={{
              flex: 1,
              padding: '10px 14px',
              border: 'none',
              borderRadius: '8px',
              background: mode === 'otp' ? '#6366f1' : 'transparent',
              color: mode === 'otp' ? '#ffffff' : '#94a3b8',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            📩 Sign in with OTP
          </button>
        </div>

        {/* Option 1: Password Form */}
        {mode === 'password' && (
          <form onSubmit={handlePasswordSubmit} className={styles.authForm}>
            {error && <div className={styles.authError}>{error}</div>}

            <div className="input-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Signing in...' : 'Sign In with Password'}
            </button>
          </form>
        )}

        {/* Option 2: OTP Form */}
        {mode === 'otp' && (
          <div>
            {otpStep === 'email' ? (
              <form onSubmit={handleRequestOtp} className={styles.authForm}>
                {error && <div className={styles.authError}>{error}</div>}

                <div className="input-group">
                  <label htmlFor="otp-email">Email</label>
                  <input
                    id="otp-email"
                    type="email"
                    className="input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%' }}>
                  {loading ? 'Sending Code...' : 'Send OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className={styles.authForm}>
                {error && <div className={styles.authError}>{error}</div>}

                <p style={{ color: '#cbd5e1', fontSize: '14px', textAlign: 'center', marginBottom: '16px' }}>
                  Enter the 6-digit code sent to <strong>{email}</strong>
                </p>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', margin: '16px 0 24px' }}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      id={`otp-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      ref={(el) => (otpRefs.current[i] = el)}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      style={{
                        width: '44px',
                        height: '52px',
                        textAlign: 'center',
                        fontSize: '22px',
                        fontWeight: '800',
                        fontFamily: 'monospace',
                        border: '2px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: '#ffffff',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#6366f1';
                        e.target.style.background = 'rgba(99, 102, 241, 0.2)';
                        e.target.style.boxShadow = '0 0 10px rgba(99, 102, 241, 0.4)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                        e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  ))}
                </div>

                <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%' }}>
                  {loading ? 'Verifying...' : 'Verify & Sign In'}
                </button>

                <p className={styles.authFooter} style={{ marginTop: '16px', textAlign: 'center' }}>
                  Didn&apos;t get the code?{' '}
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: '#818cf8', fontWeight: '600', cursor: 'pointer', padding: 0 }}
                    onClick={async () => {
                      try {
                        await sendOtp({ email });
                        setError('');
                        setOtp(['', '', '', '', '', '']);
                        setResendSuccess(true);
                        setTimeout(() => setResendSuccess(false), 4000);
                      } catch {
                        setError('Failed to resend. Try again.');
                      }
                    }}
                  >
                    Resend code
                  </button>
                </p>
                {resendSuccess && (
                  <div style={{ color: '#10b981', fontSize: '0.875rem', textAlign: 'center', marginTop: '8px', fontWeight: '600' }}>
                    ✓ A new 6-digit code has been sent!
                  </div>
                )}
              </form>
            )}
          </div>
        )}

        <p className={styles.authFooter}>
          Don&apos;t have an account?{' '}
          <Link href="/signup">Create one</Link>
        </p>
      </div>
    </div>
  );
}
