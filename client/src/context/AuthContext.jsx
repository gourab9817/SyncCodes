import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { getBackendBaseUrl } from '../config/backendUrl';
import { supabase } from '../utils/supabaseClient';
import { getStoredAccessToken, setStoredAccessToken, clearStoredAccessToken } from '../utils/authToken';

const AuthContext = createContext(null);

const API_URL = getBackendBaseUrl();

async function fetchProfile(token) {
  const res = await axios.get(`${API_URL}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('sc_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) localStorage.setItem('sc_user', JSON.stringify(user));
    else localStorage.removeItem('sc_user');
  }, [user]);

  // On mount: restore session from Supabase or stored app JWT
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (!cancelled && data.session?.access_token) {
          try {
            const profile = await fetchProfile(data.session.access_token);
            if (!cancelled) setUser(profile);
          } catch {
            if (!cancelled) {
              localStorage.removeItem('sc_user');
              setUser(null);
            }
          }
          if (!cancelled) setLoading(false);
          return;
        }
      }

      const legacy = getStoredAccessToken();
      if (legacy) {
        try {
          const profile = await fetchProfile(legacy);
          if (!cancelled) setUser(profile);
        } catch {
          if (!cancelled) {
            clearStoredAccessToken();
            localStorage.removeItem('sc_user');
            setUser(null);
          }
        }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  // Keep user in sync with Supabase auth state changes
  useEffect(() => {
    if (!supabase) return undefined;
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        localStorage.removeItem('sc_user');
        return;
      }
      if (
        session?.access_token &&
        (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED')
      ) {
        try {
          const profile = await fetchProfile(session.access_token);
          setUser(profile);
        } catch {
          /* profile sync failed */
        }
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,

      /**
       * Email + password sign-in.
       * Uses Supabase when configured (preferred); falls back to backend JWT.
       */
      login: async ({ email, password }) => {
        if (supabase) {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw new Error(error.message);
          if (data.session?.access_token) {
            const profile = await fetchProfile(data.session.access_token);
            setUser(profile);
          }
          return;
        }
        // Fallback: backend email/password (when Supabase is not configured)
        const res = await axios.post(`${API_URL}/api/auth/login`, { email, password });
        const { access_token, user: userData } = res.data;
        setStoredAccessToken(access_token);
        setUser(userData);
      },

      /**
       * Create a new account via Supabase.
       * Returns { needsEmailVerification: true, email } when Supabase sends a
       * confirmation email; the UI should then show the OTP input screen.
       * Returns { needsEmailVerification: false } when the session is issued immediately
       * (email confirmation disabled in Supabase project settings).
       */
      register: async ({ name, email, password }) => {
        if (supabase) {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: name } },
          });
          if (error) throw new Error(error.message);
          if (data.session?.access_token) {
            const profile = await fetchProfile(data.session.access_token);
            setUser(profile);
            return { needsEmailVerification: false };
          }
          // No session → Supabase sent a confirmation email with OTP
          return { needsEmailVerification: true, email };
        }
        // Fallback: backend registration
        const res = await axios.post(`${API_URL}/api/auth/register`, { name, email, password });
        const { access_token, user: userData } = res.data;
        setStoredAccessToken(access_token);
        setUser(userData);
        return { needsEmailVerification: false };
      },

      /**
       * Verify the 6-digit OTP that Supabase sent after signUp.
       * On success, Supabase issues a session and onAuthStateChange sets the user.
       */
      verifyOtp: async ({ email, token }) => {
        if (!supabase) throw new Error('Supabase not configured');
        const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
        if (error) throw new Error(error.message);
        if (data.session?.access_token) {
          const profile = await fetchProfile(data.session.access_token);
          setUser(profile);
        }
      },

      logout: async () => {
        try {
          await axios.post(`${API_URL}/api/auth/logout`, {}, { withCredentials: true });
        } catch { /* noop */ }
        clearStoredAccessToken();
        localStorage.removeItem('sc_user');
        if (supabase) {
          try { await supabase.auth.signOut(); } catch { /* noop */ }
        }
        setUser(null);
      },

      loginWithGoogle: async () => {
        if (!supabase) {
          window.location.href = `${API_URL}/api/auth/google`;
          return;
        }
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw new Error(error.message);
      },
    }),
    [loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
