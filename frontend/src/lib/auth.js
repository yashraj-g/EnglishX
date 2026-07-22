'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { login as apiLogin, signup as apiSignup, verifyOtp as apiVerifyOtp, refreshToken, getProfile } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const saveAuth = useCallback((accessToken, refresh, userData) => {
    setToken(accessToken);
    setUser(userData);
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refresh);
  }, []);

  const clearAuth = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }, []);

  // Restore session on mount
  useEffect(() => {
    async function restore() {
      const storedToken = localStorage.getItem('accessToken');
      const storedRefresh = localStorage.getItem('refreshToken');

      if (!storedToken || !storedRefresh) {
        setLoading(false);
        return;
      }

      try {
        const profile = await getProfile(storedToken);
        setToken(storedToken);
        setUser(profile);
      } catch {
        // Access token expired — try refresh
        try {
          const refreshed = await refreshToken(storedRefresh);
          const profile = await getProfile(refreshed.accessToken);
          saveAuth(refreshed.accessToken, refreshed.refreshToken, profile);
        } catch {
          clearAuth();
        }
      }
      setLoading(false);
    }
    restore();
  }, [saveAuth, clearAuth]);

  async function login(email, password) {
    const result = await apiLogin({ email, password });
    if (result.requiresLoginOtp) {
      // OTP step required — don't save tokens yet
      return result;
    }
    saveAuth(result.accessToken, result.refreshToken, result.user);
    return result.user;
  }

  async function signup({ name, email, password, inviteToken }) {
    const result = await apiSignup({ name, email, password, inviteToken });
    if (result.requiresVerification) {
      return result;
    }
    saveAuth(result.accessToken, result.refreshToken, result.user);
    return result;
  }

  async function confirmOtp({ email, otp }) {
    const result = await apiVerifyOtp({ email, otp });
    saveAuth(result.accessToken, result.refreshToken, result.user);
    return result;
  }

  function logout() {
    clearAuth();
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, confirmOtp, logout, saveAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
