const prisma = require('../../config/db');
const logger = require('../../utils/logger');
const { assertSocketInRoom, assertAuthenticated, yjsUpdateLimiter } = require('../socketGuards');

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

module.exports = (io, socket) => {
  socket.on('message:send', async ({ roomId: roomKey, content }) => {
    try {
      const authErr = assertAuthenticated(socket);
      if (authErr) return;
      if (!socket.userId || !content?.trim()) return;
      if (!yjsUpdateLimiter.allow(socket.id)) return;

      const room = await resolveRoom(roomKey);
      if (!room) return;

      const inRoomErr = assertSocketInRoom(socket, room.id);
      if (inRoomErr) return;

      const message = await prisma.message.create({
        data: { content: content.trim().slice(0, 10000), userId: socket.userId, roomId: room.id },
        include: { user: { select: { id: true, name: true, avatar: true } } },
      });

      io.to(room.id).emit('message:new', message);
    } catch (err) {
      logger.error('message:send error', err);
    }
  });
};
