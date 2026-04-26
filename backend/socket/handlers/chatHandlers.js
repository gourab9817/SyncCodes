const prisma = require('../../config/db');
const logger = require('../../utils/logger');
const {
  canSendRoomChat,
  canSendPrivateChat,
  assertAuthenticated,
  yjsUpdateLimiter,
} = require('../socketGuards');

async function resolveRoom(roomKey) {
  const raw = String(roomKey || '').trim();
  if (!raw) return null;
  return prisma.room.findFirst({
    where: {
      isActive: true,
      OR: [{ id: raw }, { joinCode: raw.toUpperCase() }],
    },
  });
}

function waitingRoomKey(canonicalRoomId) {
  return `waiting:${canonicalRoomId}`;
}

module.exports = (io, socket) => {
  socket.on('message:send', async (payload) => {
    try {
      const authErr = assertAuthenticated(socket);
      if (authErr) return;
      if (!socket.userId) return;
      if (!yjsUpdateLimiter.allow(socket.id)) return;

      const {
        roomId: roomKey,
        content,
        scope,
        threadId: rawThreadId,
      } = payload || {};

      const room = await resolveRoom(roomKey);
      if (!room) return;

      const scopeNorm = String(scope || 'ROOM').toUpperCase() === 'PRIVATE' ? 'PRIVATE' : 'ROOM';

      if (scopeNorm === 'ROOM') {
        if (!canSendRoomChat(socket, room.id)) return;
      } else if (!canSendPrivateChat(socket, room.id)) {
        return;
      }

      let participantIds = null;
      let threadIdForMsg = null;

      if (scopeNorm === 'PRIVATE') {
        const tid = rawThreadId != null ? String(rawThreadId).trim() : '';
        if (!tid) return;
        const thread = await prisma.chatThread.findFirst({
          where: { id: tid, roomId: room.id },
          include: { members: { select: { userId: true } } },
        });
        if (!thread) return;
        participantIds = thread.members.map((m) => m.userId);
        if (!participantIds.includes(socket.userId)) return;
        threadIdForMsg = thread.id;
      }

      const plain = typeof content === 'string' ? content.trim() : '';
      if (!plain) return;
      const finalContent = plain.slice(0, 20000);

      const message = await prisma.message.create({
        data: {
          content: finalContent,
          encrypted: false,
          userId: socket.userId,
          roomId: room.id,
          scope: scopeNorm,
          threadId: threadIdForMsg,
        },
        include: { user: { select: { id: true, name: true, avatar: true } } },
      });

      if (threadIdForMsg) {
        try {
          await prisma.chatThread.update({
            where: { id: threadIdForMsg },
            data: { updatedAt: new Date() },
          });
        } catch (e) {
          logger.warn(`chatThread touch skipped: ${e.message}`);
        }
      }

      if (scopeNorm === 'ROOM') {
        io.to(room.id).emit('message:new', message);
        io.to(waitingRoomKey(room.id)).emit('message:new', message);
      } else {
        for (const uid of participantIds) {
          io.to(`user:${uid}`).emit('message:new', message);
          io.to(`user:${uid}`).emit('chat:threads:refresh', { roomId: room.id });
        }
      }
    } catch (err) {
      logger.error('message:send error', err);
    }
  });
};
