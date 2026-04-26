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
const { roomJoinLimiter, yjsUpdateLimiter, assertSocketInRoom } = require('./socketGuards');
const { isOriginAllowed } = require('../config/allowedOrigins');
const { syncUser, syncSupabaseUser } = require('../services/userSyncService');
const { verifySupabaseAccessToken } = require('../lib/supabaseJwt');
const { setIo } = require('./ioInstance');

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

/** Peers already in the room (excludes `socket`) — used so joiners know host socket id for WebRTC. */
function getOtherPeersInRoom(io, roomId, socket) {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || [])
    .filter((sid) => sid !== socket.id)
    .map((sid) => {
      const s = io.sockets.sockets.get(sid);
      return {
        id: sid,
        email: socketidToEmailMap.get(sid) || null,
        userId: s?.userId || null,
      };
    });
}

function waitingRoomKey(canonicalRoomId) {
  return `waiting:${canonicalRoomId}`;
}

function collectRoomAliasKeys(room) {
  const aliasKeys = [room.id];
  if (room.joinCode) {
    aliasKeys.push(
      room.joinCode,
      room.joinCode.toUpperCase(),
      room.joinCode.toLowerCase()
    );
  }
  const seen = new Set();
  return aliasKeys.filter((k) => {
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function leaveAllWaitingRooms(socket) {
  for (const key of [...(socket.data.joinedRooms || [])]) {
    if (!String(key).startsWith('waiting:')) continue;
    socket.leave(key);
    socket.data.joinedRooms.delete(key);
    if (socket.data.roomIdByKey) delete socket.data.roomIdByKey[key];
  }
  socket.data.pendingAdmissionRoomId = null;
}

/**
 * @param {import('http').Server} server
 * @returns {Promise<import('socket.io').Server>}
 */
async function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: (origin, cb) => cb(null, isOriginAllowed(origin)),
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });
  setIo(io);

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

    (async () => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        socket.userId = decoded.sub;
        socket.userEmail = decoded.email;
        return next();
      } catch {
        /* not app JWT */
      }

      if (process.env.SUPABASE_URL) {
        try {
          const dec = await verifySupabaseAccessToken(token);
          const user = await syncSupabaseUser(dec);
          socket.userId = user.id;
          socket.userEmail = user.email;
          return next();
        } catch (supErr) {
          logger.warn(`Socket Supabase JWT: ${supErr.message}`);
        }
      }

      if (jwksClient) {
        jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, decoded) => {
          if (err || !decoded) {
            if (env.socketAuthRequired) {
              return next(new Error('auth_invalid'));
            }
            return next();
          }
          syncUser(decoded)
            .then((user) => {
              socket.userId = user.id;
              socket.userEmail = user.email;
              next();
            })
            .catch((syncErr) => {
              logger.error(`Socket RS256 syncUser: ${syncErr.message}`);
              if (env.socketAuthRequired) {
                return next(new Error('auth_invalid'));
              }
              next();
            });
        });
        return;
      }

      if (env.socketAuthRequired) {
        return next(new Error('auth_invalid'));
      }
      return next();
    })();
  });

  io.on('connection', (socket) => {
    socket.data.joinedRooms = new Set();
    // Maps any accepted key (internal id OR joinCode) -> internal room.id so
    // handlers can resolve whichever identifier the client sends.
    socket.data.roomIdByKey = Object.create(null);
    socket.data.pendingAdmissionRoomId = null;
    logger.info(`Socket connected: ${socket.id} user=${socket.userId || 'anon'}`);
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

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

        emailToSocketIdMap.set(email, socket.id);
        socketidToEmailMap.set(socket.id, email);

        const isOwner = room.ownerId === socket.userId;

        if (socket.userId) {
          try {
            await prisma.sessionMember.upsert({
              where: { userId_roomId: { userId: socket.userId, roomId: room.id } },
              create: {
                userId: socket.userId,
                roomId: room.id,
                ...(isOwner ? { admittedAt: new Date() } : {}),
              },
              update: {
                leftAt: null,
                ...(isOwner ? { admittedAt: new Date() } : { admittedAt: null }),
              },
            });
          } catch (e) {
            logger.warn(`sessionMember upsert skipped: ${e.message}`);
          }
        }
        const wKey = waitingRoomKey(room.id);

        // Non-owners wait in a Socket.IO holding room until the host admits them.
        // They never join the live session room until admitted (no roster, chat, or WebRTC).
        if (!isOwner) {
          leaveAllWaitingRooms(socket);
          const wasWaitingHere = socket.rooms.has(wKey);
          if (!wasWaitingHere) {
            socket.join(wKey);
            socket.data.joinedRooms.add(wKey);
            socket.data.roomIdByKey[wKey] = room.id;
            socket.data.pendingAdmissionRoomId = room.id;

            let joinerPublicKey = null;
            if (socket.userId) {
              try {
                const u = await prisma.user.findUnique({
                  where: { id: socket.userId },
                  select: { publicKey: true },
                });
                joinerPublicKey = u?.publicKey ?? null;
              } catch (e) {
                logger.warn(`publicKey lookup skipped: ${e.message}`);
              }
            }
            socket.to(room.id).emit('user:knock', {
              email,
              id: socket.id,
              userId: socket.userId,
              publicKey: joinerPublicKey,
            });
          }

          io.to(socket.id).emit('room:join', {
            email,
            room: room.id,
            joinCode: room.joinCode,
            ownerId: room.ownerId,
            isOwner: false,
            peers: [],
            admitted: false,
          });
          logger.info(`User ${email} waiting for admission to ${room.id} (${room.joinCode})`);
          return;
        }

        leaveAllWaitingRooms(socket);

        const wasInRoom = socket.rooms.has(room.id);
        const aliasKeys = collectRoomAliasKeys(room);
        for (const k of aliasKeys) {
          socket.join(k);
          socket.data.joinedRooms.add(k);
          socket.data.roomIdByKey[k] = room.id;
        }

        if (!wasInRoom) {
          let joinerPublicKey = null;
          if (socket.userId) {
            try {
              const u = await prisma.user.findUnique({
                where: { id: socket.userId },
                select: { publicKey: true },
              });
              joinerPublicKey = u?.publicKey ?? null;
            } catch (e) {
              logger.warn(`publicKey lookup skipped: ${e.message}`);
            }
          }
          socket.to(room.id).emit('user:joined', { email, id: socket.id, userId: socket.userId, publicKey: joinerPublicKey });
        }

        const otherPeers = getOtherPeersInRoom(io, room.id, socket);
        io.to(socket.id).emit('room:join', {
          email,
          room: room.id,
          joinCode: room.joinCode,
          ownerId: room.ownerId,
          isOwner: true,
          peers: otherPeers,
          admitted: true,
        });

        const clients = getAllConnectedClients(io, room.id);
        io.to(room.id).emit('new', { clients });

        logger.info(`User ${email} joined room ${room.id} (${room.joinCode})`);
      } catch (error) {
        logger.error(`Room join error: ${error.message}`);
        socket.emit('room:join:error', { error: 'Failed to join room. Please try again.' });
      }
    });

    socket.on('room:admit', async ({ roomId: roomKey, targetSocketId }) => {
      try {
        if (!socket.userId || !roomKey || !targetSocketId) return;
        const room = await prisma.room.findFirst({
          where: {
            isActive: true,
            OR: [{ id: String(roomKey).trim() }, { joinCode: String(roomKey).trim().toUpperCase() }],
          },
          select: { id: true, ownerId: true, joinCode: true },
        });
        if (!room || room.ownerId !== socket.userId) {
          socket.emit('room:admit:error', { error: 'Only the host can admit participants.' });
          return;
        }
        const target = io.sockets.sockets.get(targetSocketId);
        if (!target || target.data.pendingAdmissionRoomId !== room.id) {
          socket.emit('room:admit:error', { error: 'That participant is not in the waiting room.' });
          return;
        }

        const wKey = waitingRoomKey(room.id);
        target.leave(wKey);
        target.data.joinedRooms.delete(wKey);
        if (target.data.roomIdByKey) delete target.data.roomIdByKey[wKey];
        target.data.pendingAdmissionRoomId = null;

        const aliasKeys = collectRoomAliasKeys(room);
        for (const k of aliasKeys) {
          target.join(k);
          target.data.joinedRooms.add(k);
          target.data.roomIdByKey[k] = room.id;
        }

        if (target.userId) {
          try {
            await prisma.sessionMember.updateMany({
              where: { userId: target.userId, roomId: room.id },
              data: { admittedAt: new Date() },
            });
          } catch (e) {
            logger.warn(`sessionMember admittedAt update skipped: ${e.message}`);
          }
        }

        const targetEmail = socketidToEmailMap.get(target.id) || 'Guest';
        let joinerPublicKey = null;
        if (target.userId) {
          try {
            const u = await prisma.user.findUnique({
              where: { id: target.userId },
              select: { publicKey: true },
            });
            joinerPublicKey = u?.publicKey ?? null;
          } catch (e) {
            logger.warn(`publicKey lookup skipped: ${e.message}`);
          }
        }

        target.to(room.id).emit('user:joined', {
          email: targetEmail,
          id: target.id,
          userId: target.userId,
          publicKey: joinerPublicKey,
        });

        const otherPeers = getOtherPeersInRoom(io, room.id, target);
        target.emit('room:join', {
          email: targetEmail,
          room: room.id,
          joinCode: room.joinCode,
          ownerId: room.ownerId,
          isOwner: false,
          peers: otherPeers,
          admitted: true,
        });

        const clients = getAllConnectedClients(io, room.id);
        io.to(room.id).emit('new', { clients });
        logger.info(`Admitted ${targetEmail} into room ${room.id}`);
      } catch (e) {
        logger.error(`room:admit error: ${e.message}`);
        socket.emit('room:admit:error', { error: 'Failed to admit participant.' });
      }
    });

    socket.on('room:decline', async ({ roomId: roomKey, targetSocketId }) => {
      try {
        if (!socket.userId || !roomKey || !targetSocketId) return;
        const room = await prisma.room.findFirst({
          where: {
            isActive: true,
            OR: [{ id: String(roomKey).trim() }, { joinCode: String(roomKey).trim().toUpperCase() }],
          },
          select: { id: true, ownerId: true },
        });
        if (!room || room.ownerId !== socket.userId) return;
        const target = io.sockets.sockets.get(targetSocketId);
        if (!target || target.data.pendingAdmissionRoomId !== room.id) return;

        const wKey = waitingRoomKey(room.id);
        target.leave(wKey);
        target.data.joinedRooms.delete(wKey);
        if (target.data.roomIdByKey) delete target.data.roomIdByKey[wKey];
        target.data.pendingAdmissionRoomId = null;

        target.emit('room:denied', { reason: 'The host did not admit you to this session.' });
        logger.info(`Admission declined for socket ${targetSocketId} (room ${room.id})`);
      } catch (e) {
        logger.error(`room:decline error: ${e.message}`);
      }
    });

    socket.on('leave:room', async ({ roomId, email }) => {
      if (!roomId) return;

      if (socket.data.pendingAdmissionRoomId) {
        const cid = socket.data.pendingAdmissionRoomId;
        const wKey = waitingRoomKey(cid);
        socket.leave(wKey);
        socket.data.joinedRooms?.delete(wKey);
        if (socket.data.roomIdByKey) delete socket.data.roomIdByKey[wKey];
        socket.data.pendingAdmissionRoomId = null;
        return;
      }

      const canonicalId = socket.data.roomIdByKey?.[roomId] || roomId;
      // Leave both aliases so the socket is fully detached.
      socket.leave(canonicalId);
      if (canonicalId !== roomId) socket.leave(roomId);
      socket.data.joinedRooms?.delete(canonicalId);
      socket.data.joinedRooms?.delete(roomId);
      if (socket.data.roomIdByKey) {
        delete socket.data.roomIdByKey[canonicalId];
        delete socket.data.roomIdByKey[roomId];
      }

      if (socket.userId) {
        try {
          await prisma.sessionMember.updateMany({
            where: { userId: socket.userId, roomId: canonicalId, leftAt: null },
            data: { leftAt: new Date() },
          });
        } catch (e) {
          logger.warn(`sessionMember leftAt update failed: ${e.message}`);
        }
      }

      socket.to(canonicalId).emit('user:left', { id: socket.id, email });
    });

    socket.on('user:rejoin', () => {
      const emailVal = socketidToEmailMap.get(socket.id) || socket.userEmail || 'Someone';
      const seen = new Set();
      socket.data.joinedRooms?.forEach((key) => {
        if (String(key).startsWith('waiting:')) return;
        const canonical = socket.data.roomIdByKey?.[key] || key;
        if (seen.has(canonical)) return;
        seen.add(canonical);
        socket.to(canonical).emit('user:rejoined', { email: emailVal, id: socket.id });
      });
    });

    socket.on('room:end', async ({ roomId }) => {
      if (!roomId) return;
      if (assertSocketInRoom(socket, roomId) != null) return;
      if (!socket.userId) {
        socket.emit('room:end:error', { error: 'Authentication required to end a meeting.' });
        return;
      }
      try {
        const room = await prisma.room.findFirst({
          where: { isActive: true, OR: [{ id: roomId }, { joinCode: roomId.toUpperCase() }] },
          select: { id: true, ownerId: true },
        });
        if (!room) {
          socket.emit('room:end:error', { error: 'Room not found.' });
          return;
        }
        if (room.ownerId !== socket.userId) {
          socket.emit('room:end:error', { error: 'Only the room owner can end the meeting.' });
          return;
        }
        await prisma.room.update({ where: { id: room.id }, data: { isActive: false } });
        io.to(room.id).emit('meeting:ended', { roomId: room.id });
        io.to(waitingRoomKey(room.id)).emit('meeting:ended', { roomId: room.id });
        logger.info(`Meeting ended for room ${room.id} by owner ${socket.userId}`);
      } catch (e) {
        logger.error(`room:end error: ${e.message}`);
        socket.emit('room:end:error', { error: 'Failed to end the meeting.' });
      }
    });

    socket.on('disconnecting', async () => {
      const email = socketidToEmailMap.get(socket.id);
      // joinedRooms may contain both internal ids and joinCodes (aliases) —
      // collapse them to canonical internal ids before using for DB or emits.
      const canonicalRooms = new Set();
      socket.data.joinedRooms?.forEach((key) => {
        if (String(key).startsWith('waiting:')) return;
        const canonical = socket.data.roomIdByKey?.[key] || key;
        canonicalRooms.add(canonical);
      });

      if (socket.userId && canonicalRooms.size > 0) {
        try {
          await prisma.sessionMember.updateMany({
            where: { userId: socket.userId, roomId: { in: [...canonicalRooms] }, leftAt: null },
            data: { leftAt: new Date() },
          });
        } catch (e) {
          logger.warn(`sessionMember bulk leftAt update failed: ${e.message}`);
        }
      }

      canonicalRooms.forEach((roomId) => {
        socket.to(roomId).emit('user:left', { id: socket.id, email });
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
