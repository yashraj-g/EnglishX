'use client';

import { useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { verifyOtp } from '@/lib/api';
import styles from '../login/auth.module.css';

export default function SignupContent() {
  const { signup } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('token') || '';

  // Step 1: signup form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 2: OTP verification (admin only)
  const [step, setStep] = useState('form'); // 'form' | 'otp'
  const [pendingEmail, setPendingEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
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
      if (result.requiresVerification) {
        // Admin signup: needs OTP before tokens are issued
        setPendingEmail(result.email);
        setStep('otp');
      } else {
        // Learner (invite-based): tokens issued immediately
        router.push(result.user.role === 'admin' ? '/admin' : '/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Signup failed');
    }
    setLoading(false);
  }

  function handleOtpChange(index, value) {
    if (!/^\d?$/.test(value)) return; // digits only
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
      const result = await verifyOtp({ email: pendingEmail, otp: code });
      // Store tokens (same path as login)
      if (typeof window !== 'undefined') {
        localStorage.setItem('accessToken', result.accessToken);
        localStorage.setItem('refreshToken', result.refreshToken);
        localStorage.setItem('user', JSON.stringify(result.user));
      }
      router.push('/admin');
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

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', margin: '16px 0 24px' }}>
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
                    width: '52px',
                    height: '60px',
                    textAlign: 'center',
                    fontSize: '24px',
                    fontWeight: '700',
                    fontFamily: 'monospace',
                    border: '2px solid var(--border)',
                    borderRadius: '10px',
                    background: 'var(--surface)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    caretColor: 'var(--accent)',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                />
              ))}
            </div>

            <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>
          </form>

          <p className={styles.authFooter} style={{ marginTop: '16px' }}>
            Didn't receive the code?{' '}
            <button
              className="link-btn"
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0 }}
              onClick={async () => {
                try {
                  const { sendOtp } = await import('@/lib/api');
                  await sendOtp({ email: pendingEmail });
                  setError('');
                  setOtp(['', '', '', '', '', '']);
                } catch {
                  setError('Failed to resend. Try again in a moment.');
                }
              }}
            >
              Resend code
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── Signup Step ───────────────────────────────
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
            <input id="password" type="password" className="input" placeholder="At least 8 characters"
              value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
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
