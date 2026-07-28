'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <nav className={styles.navbar}>
      <div className={styles.inner}>
        <Link href={user ? '/dashboard' : '/'} className={styles.logo} onClick={() => setMenuOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="EnglishX Logo" className={styles.logoImage} />
          <span className={styles.logoText}>EnglishX</span>
        </Link>

        {/* Desktop Navigation */}
        <div className={styles.desktopLinks}>
          {user ? (
            <>
              <Link
                href="/dashboard"
                className={`${styles.link} ${pathname === '/dashboard' ? styles.active : ''}`}
              >
                Dashboard
              </Link>
              <Link
                href="/progress"
                className={`${styles.link} ${pathname === '/progress' ? styles.active : ''}`}
              >
                Progress
              </Link>
              {user.role === 'admin' && (
                <Link
                  href="/admin"
                  className={`${styles.link} ${pathname.startsWith('/admin') ? styles.active : ''}`}
                >
                  Admin
                </Link>
              )}
              <Link
                href="/practice"
                className={`${styles.link} ${pathname === '/practice' ? styles.active : ''}`}
              >
                <span className={styles.practiceIcon}>🎤</span>
                Practise
              </Link>
              <div className={styles.userMenu}>
                <div className={styles.avatar}>
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <button onClick={logout} className={`btn btn-ghost btn-sm ${styles.logoutBtn}`}>
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <>
              <Link href="/login" className={`btn btn-ghost btn-sm`}>
                Sign In
              </Link>
              <Link href="/signup" className={`btn btn-primary btn-sm`}>
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile Toggle Button */}
        <button
          type="button"
          className={styles.mobileMenuBtn}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle Navigation Menu"
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Vertical Menu Overlay */}
      {menuOpen && (
        <div className={styles.mobileMenu}>
          {user ? (
            <>
              <div className={styles.mobileUserInfo}>
                <div className={styles.avatar}>
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className={styles.mobileUserDetails}>
                  <div className={styles.mobileUserName}>{user.name || 'User'}</div>
                  <div className={styles.mobileUserEmail}>{user.email}</div>
                </div>
              </div>
              <hr className={styles.mobileDivider} />
              <Link
                href="/dashboard"
                className={`${styles.mobileLink} ${pathname === '/dashboard' ? styles.mobileActive : ''}`}
              >
                📊 Dashboard
              </Link>
              <Link
                href="/progress"
                className={`${styles.mobileLink} ${pathname === '/progress' ? styles.mobileActive : ''}`}
              >
                📈 Progress
              </Link>
              {user.role === 'admin' && (
                <Link
                  href="/admin"
                  className={`${styles.mobileLink} ${pathname.startsWith('/admin') ? styles.mobileActive : ''}`}
                >
                  🛡️ Admin Dashboard
                </Link>
              )}
              <Link
                href="/practice"
                className={`${styles.mobileLink} ${pathname === '/practice' ? styles.mobileActive : ''}`}
              >
                🎤 Practise Speaking
              </Link>
              <hr className={styles.mobileDivider} />
              <button
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className={styles.mobileLogoutBtn}
              >
                🚪 Sign Out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className={styles.mobileLink}>
                🔑 Sign In
              </Link>
              <Link href="/signup" className={styles.mobileLink}>
                🚀 Get Started
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
