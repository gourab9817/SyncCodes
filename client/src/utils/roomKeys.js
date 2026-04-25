/**
 * Room route params may be a join code (short, case-insensitive) or internal cuid.
 */
const CUID_LIKE = /^[a-z0-9]{20,32}$/i;

export function normalizeRoomRouteKey(raw) {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (!s) return "";
  if (CUID_LIKE.test(s)) return s;
  return s.toUpperCase();
}

export function isLikelyCuid(s) {
  if (!s || typeof s !== "string") return false;
  return CUID_LIKE.test(s.trim());
}
