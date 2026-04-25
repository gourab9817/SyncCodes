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
  socket.on('message:send', async ({ roomId: roomKey, content, encryptedContent, iv, recipientKeys }) => {
    try {
      const authErr = assertAuthenticated(socket);
      if (authErr) return;
      if (!socket.userId) return;
      if (!yjsUpdateLimiter.allow(socket.id)) return;

      const isEncrypted = !!(encryptedContent && iv && recipientKeys);
      const rawContent = isEncrypted ? encryptedContent : content?.trim();
      if (!rawContent) return;

      const room = await resolveRoom(roomKey);
      if (!room) return;

      const inRoomErr = assertSocketInRoom(socket, room.id);
      if (inRoomErr) return;

      const message = await prisma.message.create({
        data: {
          content: rawContent.slice(0, 20000),
          iv: isEncrypted ? iv : null,
          recipientKeys: isEncrypted ? recipientKeys : null,
          encrypted: isEncrypted,
          userId: socket.userId,
          roomId: room.id,
        },
        include: { user: { select: { id: true, name: true, avatar: true, publicKey: true } } },
      });

      io.to(room.id).emit('message:new', message);
    } catch (err) {
      logger.error('message:send error', err);
    }
  });

  // When a user registers/updates their E2E public key, broadcast it to every
  // room they're currently in. Fixes the race where a peer joined before
  // registering their key, so the `user:joined` event carried publicKey=null
  // and the other clients never learned of it — causing their subsequent
  // encrypted messages to lack a wrapped key for that peer.
  socket.on('chat:publicKey:broadcast', ({ publicKey }) => {
    if (!socket.userId) return;
    if (typeof publicKey !== 'string' || !publicKey || publicKey.length > 1000) return;
    for (const roomId of socket.data.joinedRooms || []) {
      socket.to(roomId).emit('chat:publicKey:update', {
        userId: socket.userId,
        publicKey,
      });
    }
  });
};
