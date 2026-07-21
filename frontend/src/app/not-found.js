import Link from 'next/link';

export const metadata = {
  title: '404 — Page Not Found | EnglishX',
  description: 'The page you are looking for does not exist.',
};

export default function NotFound() {
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
      {/* Large 404 */}
      <div style={{
        fontSize: '7rem',
        fontWeight: 900,
        lineHeight: 1,
        letterSpacing: '-0.05em',
        background: 'var(--gradient-hero)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}>
        404
      </div>

      <h1 style={{
        fontSize: '1.75rem',
        fontWeight: 800,
        letterSpacing: '-0.02em',
        margin: 0,
      }}>
        Page not found
      </h1>

      <p style={{
        fontSize: '1rem',
        color: 'var(--text-secondary)',
        maxWidth: '420px',
        lineHeight: 1.6,
        margin: 0,
      }}>
        We couldn&apos;t find the page you were looking for. It may have moved
        or the link might be incorrect.
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/dashboard" className="btn btn-primary" id="not-found-dashboard-btn">
          🏠 Go to Dashboard
        </Link>
        <Link href="/" className="btn btn-secondary" id="not-found-home-btn">
          ← Home
        </Link>
      </div>
    </div>
  );
}
