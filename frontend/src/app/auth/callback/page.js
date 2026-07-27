'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getProfile } from '@/lib/api';

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { saveAuth } = useAuth();

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    const role = searchParams.get('role');
    const error = searchParams.get('error');

    if (error) {
      router.replace('/login?error=oauth_failed');
      return;
    }

    if (!accessToken || !refreshToken) {
      router.replace('/login?error=missing_tokens');
      return;
    }

    async function completeAuth() {
      try {
        const profile = await getProfile(accessToken);
        saveAuth(accessToken, refreshToken, profile);
        router.replace(profile.role === 'admin' || role === 'admin' ? '/admin' : '/dashboard');
      } catch {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        router.replace(role === 'admin' ? '/admin' : '/dashboard');
      }
    }

    completeAuth();
  }, [searchParams, router, saveAuth]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      flexDirection: 'column',
      gap: '16px',
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid var(--primary-200)',
        borderTopColor: 'var(--primary-500)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ color: 'var(--text-secondary)' }}>Completing sign-in…</p>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<div />}>
      <OAuthCallbackContent />
    </Suspense>
  );
}
