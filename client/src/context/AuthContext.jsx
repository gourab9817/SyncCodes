import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { getBackendBaseUrl } from '../config/backendUrl';

const AuthContext = createContext(null);

const API_URL = getBackendBaseUrl();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('sc_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) localStorage.setItem('sc_user', JSON.stringify(user));
    else localStorage.removeItem('sc_user');
  }, [user]);

  // Check if token exists on mount and fetch user profile
  useEffect(() => {
    const token = localStorage.getItem('neon_access_token');
    if (token && !user) {
      setLoading(true);
      axios
        .get(`${API_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('neon_access_token');
          localStorage.removeItem('sc_user');
        })
        .finally(() => setLoading(false));
    }
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      loading,
      login: async ({ email, password }) => {
        const res = await axios.post(`${API_URL}/api/auth/login`, {
          email,
          password,
        });
        const { access_token, user: userData } = res.data;
        localStorage.setItem('neon_access_token', access_token);
        setUser(userData);
      },
      register: async ({ name, email, password }) => {
        const res = await axios.post(`${API_URL}/api/auth/register`, {
          name,
          email,
          password,
        });
        const { access_token, user: userData } = res.data;
        localStorage.setItem('neon_access_token', access_token);
        setUser(userData);
      },
      logout: async () => {
        try {
          await axios.post(`${API_URL}/api/auth/logout`, {}, { withCredentials: true });
        } catch {}
        localStorage.removeItem('neon_access_token');
        localStorage.removeItem('sc_user');
        setUser(null);
      },
      loginWithGoogle: () => {
        window.location.href = `${API_URL}/api/auth/google`;
      },
    }),
    [loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
