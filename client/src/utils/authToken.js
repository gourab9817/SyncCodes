/** Primary key for API + Socket tokens from email/password login. */
export const ACCESS_TOKEN_KEY = 'sc_access_token';

const LEGACY_KEYS = ['neon_access_token', ACCESS_TOKEN_KEY];

export function getStoredAccessToken() {
  for (const k of LEGACY_KEYS) {
    const t = localStorage.getItem(k);
    if (t) return t;
  }
  return null;
}

export function setStoredAccessToken(token) {
  localStorage.removeItem('neon_access_token');
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearStoredAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem('neon_access_token');
}
