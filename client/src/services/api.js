import axios from 'axios';
import { getBackendBaseUrl } from '../config/backendUrl';
import { supabase } from '../utils/supabaseClient';
import { getStoredAccessToken, setStoredAccessToken, clearStoredAccessToken } from '../utils/authToken';

const BASE_URL = getBackendBaseUrl();

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use(
  async (config) => {
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        config.headers.Authorization = `Bearer ${data.session.access_token}`;
        return config;
      }
    }
    const token = getStoredAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let refreshing = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (
      error.response?.status === 401 &&
      !original._retried &&
      !original.url?.includes('/api/auth/refresh') &&
      !original.url?.includes('/api/auth/logout')
    ) {
      original._retried = true;

      try {
        if (supabase) {
          const { data: ref } = await supabase.auth.refreshSession();
          if (ref.session?.access_token) {
            original.headers.Authorization = `Bearer ${ref.session.access_token}`;
            return api(original);
          }
        }

        if (!refreshing) {
          refreshing = axios
            .post(`${BASE_URL}/api/auth/refresh`, {}, { withCredentials: true })
            .finally(() => {
              refreshing = null;
            });
        }

        const { data } = await refreshing;
        const { access_token, user } = data;

        setStoredAccessToken(access_token);
        if (user) localStorage.setItem('sc_user', JSON.stringify(user));

        original.headers.Authorization = `Bearer ${access_token}`;
        return api(original);
      } catch {
        clearStoredAccessToken();
        localStorage.removeItem('sc_user');
        if (supabase) {
          try {
            await supabase.auth.signOut();
          } catch {
            /* noop */
          }
        }
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
