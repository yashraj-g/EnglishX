'use client';

import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <nav className={styles.navbar}>
      <div className={styles.inner}>
        <Link href={user ? '/dashboard' : '/'} className={styles.logo}>
          <img src="/logo.jpg" alt="EnglishX Logo" className={styles.logoImage} />
          <span className={styles.logoText}>EnglishX</span>
        </Link>

        <div className={styles.links}>
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
      </div>
    </nav>
  );
}
