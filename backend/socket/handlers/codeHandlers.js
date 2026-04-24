const logger = require('../../utils/logger');
const {
  assertSocketInRoom,
  assertTargetInSameRoom,
  assertAuthenticated,
  validateYjsUpdate,
  validateYjsState,
  yjsUpdateLimiter,
} = require('../socketGuards');

const MAX_CODE_SNAPSHOT_CHARS = parseInt(process.env.CODE_SNAPSHOT_MAX_CHARS || '500000', 10);

module.exports = (io, socket) => {
  socket.on('code:change', ({ roomId, code }) => {
    const authErr = assertAuthenticated(socket);
    if (authErr) return;
    if (assertSocketInRoom(socket, roomId)) return;
    if (typeof code === 'string' && code.length > MAX_CODE_SNAPSHOT_CHARS) {
      logger.warn(`code:change rejected: snapshot too large from ${socket.id}`);
      return;
    }
    socket.to(roomId).emit('code:change', { code });
  });

  socket.on('sync:code', ({ socketId, code }) => {
    const authErr = assertAuthenticated(socket);
    if (authErr) return;
    if (typeof code === 'string' && code.length > MAX_CODE_SNAPSHOT_CHARS) return;
    if (socketId != null && code != null) {
      if (assertTargetInSameRoom(io, socket, socketId)) return;
      io.to(socketId).emit('code:change', { code });
    }
  });

  socket.on('yjs:update', ({ roomId, update }) => {
    const authErr = assertAuthenticated(socket);
    if (authErr) return;
    if (assertSocketInRoom(socket, roomId)) return;
    if (!yjsUpdateLimiter.allow(socket.id)) {
      logger.warn(`yjs:update rate limited socket=${socket.id}`);
      return;
    }
    const v = validateYjsUpdate(update);
    if (v) return;
    socket.to(roomId).emit('yjs:update', { update });
  });

  socket.on('yjs:sync-request', ({ roomId }) => {
    const authErr = assertAuthenticated(socket);
    if (authErr) return;
    if (assertSocketInRoom(socket, roomId)) return;
    socket.to(roomId).emit('yjs:sync-request', { requesterId: socket.id });
  });

  socket.on('yjs:sync-response', ({ requesterId, state }) => {
    const authErr = assertAuthenticated(socket);
    if (authErr) return;
    if (!requesterId || !state?.length) return;
    if (assertTargetInSameRoom(io, socket, requesterId)) return;
    const v = validateYjsState(state);
    if (v) return;
    if (!yjsUpdateLimiter.allow(socket.id)) {
      logger.warn(`yjs:sync-response rate limited socket=${socket.id}`);
      return;
    }
    io.to(requesterId).emit('yjs:sync-response', { state });
  });

  socket.on('language:change', ({ roomId, language, snippet }) => {
    const authErr = assertAuthenticated(socket);
    if (authErr) return;
    if (assertSocketInRoom(socket, roomId)) return;
    socket.to(roomId).emit('language:change', { language, snippet });
  });

  socket.on('output', ({ roomId, output }) => {
    const authErr = assertAuthenticated(socket);
    if (authErr) return;
    if (assertSocketInRoom(socket, roomId)) return;
    const text = typeof output === 'string' ? output : String(output ?? '');
    if (text.length > 200000) return;
    socket.to(roomId).emit('output', { output: text });
  });
};
