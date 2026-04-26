const logger = require('../utils/logger');
const env = require('../config/env');

const parseIntEnv = (key, fallback) => {
  const v = parseInt(process.env[key] || String(fallback), 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

const MAX_YJS_UPDATE_BYTES = parseIntEnv('YJS_MAX_UPDATE_BYTES', 262144);
const MAX_YJS_STATE_BYTES = parseIntEnv('YJS_MAX_STATE_BYTES', 524288);
const YJS_UPDATES_PER_WINDOW = parseIntEnv('YJS_UPDATES_PER_WINDOW', 200);
const YJS_WINDOW_MS = parseIntEnv('YJS_WINDOW_MS', 10000);
const ROOM_JOIN_PER_WINDOW = parseIntEnv('ROOM_JOIN_PER_WINDOW', 30);
const ROOM_JOIN_WINDOW_MS = parseIntEnv('ROOM_JOIN_WINDOW_MS', 60000);

function byteLength(arr) {
  if (!arr) return 0;
  if (typeof arr.length === 'number') return arr.length;
  return 0;
}

/**
 * Sliding-window rate limit per socket id (in-memory; resets on process restart).
 */
function createSlidingWindowLimiter(maxEvents, windowMs) {
  const hits = new Map();

  const prune = (socketId, now) => {
    const list = hits.get(socketId);
    if (!list) return [];
    const cutoff = now - windowMs;
    const kept = list.filter((t) => t > cutoff);
    if (kept.length === 0) hits.delete(socketId);
    else hits.set(socketId, kept);
    return kept;
  };

  return {
    allow(socketId) {
      const now = Date.now();
      const list = prune(socketId, now);
      if (list.length >= maxEvents) return false;
      list.push(now);
      hits.set(socketId, list);
      return true;
    },
    remove(socketId) {
      hits.delete(socketId);
    },
  };
}

const yjsUpdateLimiter = createSlidingWindowLimiter(YJS_UPDATES_PER_WINDOW, YJS_WINDOW_MS);
const roomJoinLimiter = createSlidingWindowLimiter(ROOM_JOIN_PER_WINDOW, ROOM_JOIN_WINDOW_MS);

function assertSocketInRoom(socket, roomId) {
  if (!roomId || typeof roomId !== 'string') return 'invalid_room';
  const j = socket.data.joinedRooms;
  if (j?.has(roomId)) return null;
  const m = socket.data.roomIdByKey;
  if (!m) return 'not_in_room';
  const c =
    m[roomId] ||
    (roomId.length <= 20 ? m[roomId.toUpperCase()] || m[roomId.toLowerCase()] : null);
  if (c && j.has(c)) return null;
  return 'not_in_room';
}

/** Everyone-chat: live session room or waiting lobby for the same canonical room. */
function canSendRoomChat(socket, canonicalRoomId) {
  if (!canonicalRoomId) return false;
  if (assertSocketInRoom(socket, canonicalRoomId) == null) return true;
  if (socket.data.pendingAdmissionRoomId === canonicalRoomId) return true;
  return false;
}

/** Private / E2E: only admitted participants (in the Socket.IO session room). */
function canSendPrivateChat(socket, canonicalRoomId) {
  return assertSocketInRoom(socket, canonicalRoomId) == null;
}

/**
 * Checks that the sender (socket) and the target socketId share at least one
 * room. Prevents cross-room code pushes (e.g. sync:code, yjs:sync-response).
 */
function assertTargetInSameRoom(io, socket, targetSocketId) {
  if (!targetSocketId || typeof targetSocketId !== 'string') return 'invalid_target';
  for (const roomId of socket.data.joinedRooms || []) {
    const room = io.sockets.adapter.rooms.get(roomId);
    if (room && room.has(targetSocketId)) return null;
  }
  return 'target_not_in_room';
}

function assertAuthenticated(socket) {
  if (!env.socketAuthRequired) return null;
  if (!socket.userId) return 'unauthenticated';
  return null;
}

function validateYjsUpdate(update) {
  const n = byteLength(update);
  if (n === 0) return 'empty';
  if (n > MAX_YJS_UPDATE_BYTES) {
    logger.warn(`yjs:update rejected: payload ${n} bytes > ${MAX_YJS_UPDATE_BYTES}`);
    return 'too_large';
  }
  return null;
}

function validateYjsState(state) {
  const n = byteLength(state);
  if (n === 0) return 'empty';
  if (n > MAX_YJS_STATE_BYTES) {
    logger.warn(`yjs:sync-response rejected: payload ${n} bytes > ${MAX_YJS_STATE_BYTES}`);
    return 'too_large';
  }
  return null;
}

module.exports = {
  createSlidingWindowLimiter,
  assertSocketInRoom,
  canSendRoomChat,
  canSendPrivateChat,
  assertTargetInSameRoom,
  assertAuthenticated,
  validateYjsUpdate,
  validateYjsState,
  yjsUpdateLimiter,
  roomJoinLimiter,
  MAX_YJS_UPDATE_BYTES,
  MAX_YJS_STATE_BYTES,
};
