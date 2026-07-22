'use client';

import { useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { sendOtp } from '@/lib/api';
import styles from '../login/auth.module.css';

export default function SignupContent() {
  const { signup, confirmOtp } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('token') || '';

  // Step 1: signup form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 2: OTP verification via AWS SES
  const [step, setStep] = useState('form'); // 'form' | 'otp'
  const [pendingEmail, setPendingEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resendSuccess, setResendSuccess] = useState(false);
  const otpRefs = useRef([]);

  async function handleSignup(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const result = await signup({ name, email, password, inviteToken: inviteToken || undefined });
      if (result?.requiresVerification) {
        setPendingEmail(result.email);
        setStep('otp');
      } else if (result?.user) {
        router.push(result.user.role === 'admin' ? '/admin' : '/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Signup failed');
    }
    setLoading(false);
  }

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
      const result = await confirmOtp({ email: pendingEmail, otp: code });
      router.push(result.user?.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.message || 'Verification failed');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    }
    setLoading(false);
  }

  // ── OTP Step ─────────────────────────────────
  if (step === 'otp') {
    return (
      <div className={styles.authPage}>
        <div className={styles.authCard}>
          <div className={styles.authHeader}>
            <h1>Verify your email</h1>
            <p>We sent a 6-digit code to <strong>{pendingEmail}</strong></p>
          </div>

          <form onSubmit={handleVerifyOtp} className={styles.authForm}>
            {error && <div className={styles.authError}>{error}</div>}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', margin: '20px 0 28px' }}>
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
                    width: '46px',
                    height: '56px',
                    textAlign: 'center',
                    fontSize: '24px',
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
                    e.target.style.borderColor = '#f59e0b';
                    e.target.style.background = 'rgba(245, 158, 11, 0.15)';
                    e.target.style.boxShadow = '0 0 10px rgba(245, 158, 11, 0.3)';
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
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>
          </form>

          <p className={styles.authFooter} style={{ marginTop: '16px' }}>
            Didn&apos;t receive the code?{' '}
            <button
              className="link-btn"
              type="button"
              style={{ background: 'none', border: 'none', color: '#f59e0b', fontWeight: '600', cursor: 'pointer', padding: 0 }}
              onClick={async () => {
                try {
                  await sendOtp({ email: pendingEmail });
                  setError('');
                  setOtp(['', '', '', '', '', '']);
                  setResendSuccess(true);
                  setTimeout(() => setResendSuccess(false), 4000);
                } catch {
                  setError('Failed to resend. Try again in a moment.');
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
        </div>
      </div>
    );
  }

  // ── Signup Form ───────────────────────────────
  return (
    <div className={styles.authPage}>
      <div className={styles.authCard}>
        <div className={styles.authHeader}>
          <h1>{inviteToken ? 'Accept Invite' : 'Create Account'}</h1>
          <p>{inviteToken ? 'Complete your signup to start practising' : 'Start your English speaking journey'}</p>
        </div>

        <form onSubmit={handleSignup} className={styles.authForm}>
          {error && <div className={styles.authError}>{error}</div>}

          <div className="input-group">
            <label htmlFor="name">Full Name</label>
            <input id="name" type="text" className="input" placeholder="Your name"
              value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" className="input" placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <div className={styles.passwordWrapper}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className={`${styles.passwordInput} input`}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              <button
                type="button"
                className={styles.eyeToggle}
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Creating account...' : inviteToken ? 'Accept & Join' : 'Create Account'}
          </button>
        </form>

        <p className={styles.authFooter}>
          Already have an account?{' '}
          <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
