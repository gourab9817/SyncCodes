/**
 * Single backend origin for REST, Socket.IO, and auth.
 *
 * RCA: Socket.IO must hit the same host:port as the API. Using only
 * `window.location.origin` breaks when the SPA is on :3000 / :5173 and the
 * API is on :8000. Relying only on `NODE_ENV === 'development'` breaks when a
 * production build is served locally on :3000 (NODE_ENV is production in the
 * bundle). So: if REACT_APP_API_URL is unset, map browser localhost/127.0.0.1
 * to port 8000 unless the app is already being served from 8000.
 */
export function getBackendBaseUrl() {
  const raw = (typeof process !== "undefined" && process.env?.REACT_APP_API_URL) || "";
  const trimmed = String(raw).trim();
  if (trimmed && trimmed !== "/") {
    return trimmed.replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location) {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") {
      const port = window.location.port;
      if (port === "8000" || (port === "" && window.location.origin.includes(":8000"))) {
        return window.location.origin;
      }
      const proto = window.location.protocol || "http:";
      return `${proto}//${h}:8000`;
    }
    return window.location.origin;
  }
  if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
    return "http://localhost:8000";
  }
  return "";
}
