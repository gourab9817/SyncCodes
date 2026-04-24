const { Server } = require('socket.io');
const jwks = require('jwks-rsa');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const prisma = require('../config/db');
const env = require('../config/env');
const codeHandlers = require('./handlers/codeHandlers');
const videoHandlers = require('./handlers/videoHandlers');
const whiteboardHandlers = require('./handlers/whiteboardHandlers');
const chatHandlers = require('./handlers/chatHandlers');
const { roomJoinLimiter, yjsUpdateLimiter } = require('./socketGuards');

const jwksClient = process.env.NEON_JWKS ? jwks({
  jwksUri: process.env.NEON_JWKS,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000,
}) : null;

const getKey = (header, cb) => {
  if (!jwksClient) return cb(new Error('JWKS not configured'));
  jwksClient.getSigningKey(header.kid, (err, key) => {
    cb(err, key?.getPublicKey());
  });
};

const emailToSocketIdMap = new Map();
const socketidToEmailMap = new Map();

const getAllConnectedClients = (io, roomId) =>
  Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => ({
    socketId,
    email: socketidToEmailMap.get(socketId),
  }));

/**
 * @param {import('http').Server} server
 * @param {string} clientUrl
 * @returns {Promise<import('socket.io').Server>}
 */
async function initSocket(server, clientUrl) {
  const io = new Server(server, {
    cors: {
      origin: clientUrl || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  if (env.redisUrl) {
    try {
      const { createClient } = require('redis');
      const { createAdapter } = require('@socket.io/redis-adapter');
      const pubClient = createClient({ url: env.redisUrl });
      const subClient = pubClient.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Socket.IO: Redis adapter enabled (multi-instance fan-out)');
    } catch (e) {
      logger.error(`Socket.IO: Redis adapter failed — ${e.message}`);
      throw e;
    }
  }

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      if (env.socketAuthRequired) {
        return next(new Error('auth_required'));
      }
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      socket.userId = decoded.sub;
      socket.userEmail = decoded.email;
      return next();
    } catch (localErr) {
      if (jwksClient) {
        return jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, decoded) => {
          if (!err && decoded) {
            socket.userId = decoded.sub;
            socket.userEmail = decoded.email;
          }
          if (env.socketAuthRequired && !socket.userId) {
            return next(new Error('auth_invalid'));
          }
          return next();
        });
      }
    }
    if (env.socketAuthRequired) {
      return next(new Error('auth_invalid'));
    }
    return next();
  });

  io.on('connection', (socket) => {
    socket.data.joinedRooms = new Set();
    logger.info(`Socket connected: ${socket.id} user=${socket.userId || 'anon'}`);

    socket.on('room:join', async (data) => {
      const { email: clientEmail, room: roomKey } = data || {};

      if (!roomJoinLimiter.allow(socket.id)) {
        socket.emit('room:join:error', { error: 'Too many join attempts. Try again in a minute.' });
        logger.warn(`room:join rate limited socket=${socket.id}`);
        return;
      }

      const email = (socket.userEmail || clientEmail || '').trim();
      if (!email) {
        socket.emit('room:join:error', { error: 'Email or name is required' });
        return;
      }

      if (env.socketAuthRequired) {
        if (!socket.userId || !socket.userEmail) {
          socket.emit('room:join:error', { error: 'You must be signed in to join a room.' });
          return;
        }
        if (clientEmail && String(clientEmail).trim().toLowerCase() !== socket.userEmail.toLowerCase()) {
          socket.emit('room:join:error', { error: 'Email must match the signed-in account.' });
          return;
        }
      }

      try {
        const raw = String(roomKey || '').trim();
        if (!raw) {
          socket.emit('room:join:error', { error: 'Room code or link is required' });
          return;
        }

        const room = await prisma.room.findFirst({
          where: {
            isActive: true,
            OR: [{ id: raw }, { joinCode: raw.toUpperCase() }],
          },
          include: { owner: true },
        });

        if (!room) {
          socket.emit('room:join:error', {
            error: 'Invalid or inactive room code. Please check the session ID and try again.',
          });
          logger.warn(`Rejected join attempt for unknown room key: ${raw}`);
          return;
        }

        if (socket.userId) {
          try {
            await prisma.sessionMember.upsert({
              where: { userId_roomId: { userId: socket.userId, roomId: room.id } },
              create: { userId: socket.userId, roomId: room.id },
              update: { leftAt: null },
            });
          } catch (e) {
            logger.warn(`sessionMember upsert skipped: ${e.message}`);
          }
        }

        emailToSocketIdMap.set(email, socket.id);
        socketidToEmailMap.set(socket.id, email);

        const wasInRoom = socket.rooms.has(room.id);
        socket.join(room.id);
        socket.data.joinedRooms.add(room.id);

        if (!wasInRoom) {
          // socket.to() excludes the sender — the joiner must not receive their
          // own user:joined event or they will see themselves in the admit dialog.
          socket.to(room.id).emit('user:joined', { email, id: socket.id });
        }

        io.to(socket.id).emit('room:join', { email, room: room.id, joinCode: room.joinCode });

        const clients = getAllConnectedClients(io, room.id);
        io.to(room.id).emit('new', { clients });

        logger.info(`User ${email} joined room ${room.id} (${room.joinCode})`);
      } catch (error) {
        logger.error(`Room join error: ${error.message}`);
        socket.emit('room:join:error', { error: 'Failed to join room. Please try again.' });
      }
    });

    socket.on('leave:room', async ({ roomId, email }) => {
      if (roomId) {
        socket.leave(roomId);
        socket.data.joinedRooms?.delete(roomId);

        if (socket.userId) {
          try {
            await prisma.sessionMember.updateMany({
              where: { userId: socket.userId, roomId, leftAt: null },
              data: { leftAt: new Date() },
            });
          } catch (e) {
            logger.warn(`sessionMember leftAt update failed: ${e.message}`);
          }
        }

        socket.to(roomId).emit('user:left', { email });
      }
    });

    socket.on('disconnecting', async () => {
      const email = socketidToEmailMap.get(socket.id);
      const joinedRooms = [...(socket.data.joinedRooms || [])];

      // Stamp leftAt for all rooms this socket was in
      if (socket.userId && joinedRooms.length > 0) {
        try {
          await prisma.sessionMember.updateMany({
            where: { userId: socket.userId, roomId: { in: joinedRooms }, leftAt: null },
            data: { leftAt: new Date() },
          });
        } catch (e) {
          logger.warn(`sessionMember bulk leftAt update failed: ${e.message}`);
        }
      }

      socket.rooms.forEach((roomId) => {
        if (roomId !== socket.id) {
          socket.to(roomId).emit('user:left', { id: socket.id, email });
        }
      });
      emailToSocketIdMap.forEach((sid, em) => {
        if (sid === socket.id) emailToSocketIdMap.delete(em);
      });
      socketidToEmailMap.delete(socket.id);
      roomJoinLimiter.remove(socket.id);
      yjsUpdateLimiter.remove(socket.id);
    });

    codeHandlers(io, socket);
    videoHandlers(io, socket);
    whiteboardHandlers(io, socket);
    chatHandlers(io, socket);
  });

  return io;
}

module.exports = initSocket;
