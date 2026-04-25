import axios from 'axios';
import { getBackendBaseUrl } from '../config/backendUrl';

const BASE_URL = getBackendBaseUrl();

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // sends the httpOnly refresh cookie automatically
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('neon_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Track whether a refresh is already in flight so we don't send multiple
let refreshing = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // Only attempt refresh for 401s that haven't already been retried and
    // are not the refresh/logout endpoints themselves (avoid infinite loops).
    if (
      error.response?.status === 401 &&
      !original._retried &&
      !original.url?.includes('/api/auth/refresh') &&
      !original.url?.includes('/api/auth/logout')
    ) {
      original._retried = true;

      try {
        // Deduplicate: if another request already kicked off a refresh, reuse it
        if (!refreshing) {
          refreshing = axios
            .post(`${BASE_URL}/api/auth/refresh`, {}, { withCredentials: true })
            .finally(() => { refreshing = null; });
        }

        const { data } = await refreshing;
        const { access_token, user } = data;

        localStorage.setItem('neon_access_token', access_token);
        if (user) localStorage.setItem('sc_user', JSON.stringify(user));

        // Retry the original request with the new token
        original.headers.Authorization = `Bearer ${access_token}`;
        return api(original);
      } catch {
        // Refresh failed — session is truly expired, send to login
        localStorage.removeItem('neon_access_token');
        localStorage.removeItem('sc_user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
