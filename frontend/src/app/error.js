'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    // Log to console in dev; in production swap for a real error service (e.g. Sentry)
    console.error('[GlobalError boundary]', error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '24px',
      padding: '24px',
      textAlign: 'center',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* Icon */}
      <div style={{ fontSize: '3.5rem', lineHeight: 1 }}>⚠️</div>

      {/* Heading */}
      <h1 style={{
        fontSize: '1.75rem',
        fontWeight: 800,
        letterSpacing: '-0.02em',
        margin: 0,
      }}>
        Something went wrong
      </h1>

      {/* Friendly message — never expose the raw error message to users */}
      <p style={{
        fontSize: '1rem',
        color: 'var(--text-secondary)',
        maxWidth: '460px',
        lineHeight: 1.6,
        margin: 0,
      }}>
        An unexpected error occurred. Our team has been notified. You can try
        refreshing the page or head back to the dashboard.
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          id="error-retry-btn"
          className="btn btn-primary"
          onClick={() => reset()}
        >
          🔄 Try Again
        </button>
        <Link href="/dashboard" className="btn btn-secondary" id="error-home-btn">
          🏠 Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
