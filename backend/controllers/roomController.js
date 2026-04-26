const prisma = require('../config/db');
const { z } = require('zod');
const { customAlphabet } = require('nanoid');

/** 16 uppercase alphanumeric chars — unambiguous, single visual room id for all clients */
const generateJoinCode = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 16);

const createRoom = async (req, res, next) => {
  try {
    const { name, language } = z
      .object({ name: z.string().max(100).optional(), language: z.string().optional() })
      .parse(req.body);

    const room = await prisma.room.create({
      data: {
        joinCode: generateJoinCode(),
        name,
        language: language || 'javascript',
        ownerId: req.user.id,
      },
    });
    res.status(201).json(room);
  } catch (err) {
    next(err);
  }
};

const listRooms = async (req, res, next) => {
  try {
    const rooms = await prisma.room.findMany({
      where: { ownerId: req.user.id, isActive: true },
      include: {
        _count: { select: { memberships: true, messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(rooms);
  } catch (err) {
    next(err);
  }
};

const getRoom = async (req, res, next) => {
  try {
    const room = await prisma.room.findUnique({
      where: { id: req.params.id },
      include: {
        owner: { select: { id: true, name: true, avatar: true } },
        _count: { select: { memberships: true } },
      },
    });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // Only the owner or a session member can view room details
    if (room.ownerId !== req.user.id) {
      const membership = await prisma.sessionMember.findUnique({
        where: { userId_roomId: { userId: req.user.id, roomId: room.id } },
      });
      if (!membership) return res.status(403).json({ error: 'Access denied' });
    }

    res.json(room);
  } catch (err) {
    next(err);
  }
};

const getRoomByCode = async (req, res, next) => {
  try {
    const room = await prisma.room.findUnique({
      where: { joinCode: req.params.code.toUpperCase() },
      include: { owner: { select: { id: true, name: true, avatar: true } } },
    });
    if (!room || !room.isActive) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (err) {
    next(err);
  }
};

const deleteRoom = async (req, res, next) => {
  try {
    const room = await prisma.room.findUnique({ where: { id: req.params.id } });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.ownerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    await prisma.room.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'Room deleted' });
  } catch (err) {
    next(err);
  }
};

const getRoomMessages = async (req, res, next) => {
  try {
    const room = await prisma.room.findUnique({ where: { id: req.params.id } });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (room.ownerId !== req.user.id) {
      const membership = await prisma.sessionMember.findUnique({
        where: { userId_roomId: { userId: req.user.id, roomId: room.id } },
      });
      if (!membership) return res.status(403).json({ error: 'Access denied' });
    }

    const scope = String(req.query.scope || 'ROOM').toUpperCase();
    if (scope !== 'ROOM' && scope !== 'PRIVATE') {
      return res.status(400).json({ error: 'Invalid scope' });
    }

    const { cursor, limit = 50 } = req.query;
    const safeLimit = Math.min(parseInt(limit, 10) || 50, 100);

    /** @type {import('@prisma/client').Prisma.MessageWhereInput} */
    const where = { roomId: req.params.id };
    if (scope === 'ROOM') {
      // Include legacy rows created before `scope` existed (treated as everyone chat).
      where.OR = [{ scope: 'ROOM' }, { scope: null }];
    } else {
      const threadId = String(req.query.threadId || '').trim();
      if (!threadId) {
        return res.status(400).json({ error: 'threadId is required for private messages' });
      }
      const mem = await prisma.chatThreadMember.findUnique({
        where: { threadId_userId: { threadId, userId: req.user.id } },
      });
      if (!mem) return res.status(403).json({ error: 'You are not in this chat thread' });
      where.scope = 'PRIVATE';
      where.threadId = threadId;
    }

    const messages = await prisma.message.findMany({
      where,
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });
    res.json(messages.reverse());
  } catch (err) {
    next(err);
  }
};

const getRoomParticipants = async (req, res, next) => {
  try {
    const room = await prisma.room.findUnique({
      where: { id: req.params.id },
      include: {
        owner: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (room.ownerId !== req.user.id) {
      const membership = await prisma.sessionMember.findUnique({
        where: { userId_roomId: { userId: req.user.id, roomId: room.id } },
      });
      if (!membership) return res.status(403).json({ error: 'Access denied' });
    }

    const members = await prisma.sessionMember.findMany({
      where: { roomId: room.id, leftAt: null },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    });

    const byId = new Map();
    if (room.owner) byId.set(room.owner.id, { ...room.owner });
    for (const m of members) {
      if (m.user) {
        byId.set(m.user.id, {
          ...m.user,
          sessionMember: {
            joinedAt: m.joinedAt,
            admittedAt: m.admittedAt,
          },
        });
      }
    }
    const ownerEntry = byId.get(room.ownerId);
    if (ownerEntry && !ownerEntry.sessionMember) {
      ownerEntry.sessionMember = { isOwner: true, joinedAt: room.createdAt };
    }
    res.json({ participants: [...byId.values()] });
  } catch (err) {
    next(err);
  }
};

const joinRoom = async (req, res, next) => {
  try {
    const { code } = req.params;
    const room = await prisma.room.findUnique({
      where: { joinCode: code.toUpperCase() },
      include: { owner: { select: { id: true, name: true, avatar: true } } }
    });
    
    if (!room || !room.isActive) {
      return res.status(404).json({ error: 'Room not found or inactive' });
    }
    
    await prisma.sessionMember.upsert({
      where: { 
        userId_roomId: { 
          userId: req.user.id, 
          roomId: room.id 
        } 
      },
      create: { 
        userId: req.user.id, 
        roomId: room.id 
      },
      update: { 
        leftAt: null
      }
    });
    
    res.json({ 
      success: true, 
      room: {
        id: room.id,
        joinCode: room.joinCode,
        name: room.name,
        language: room.language,
        owner: room.owner
      }
    });
  } catch (err) {
    next(err);
  }
};

const listRoomChatThreads = async (req, res, next) => {
  try {
    const room = await prisma.room.findUnique({ where: { id: req.params.id } });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (room.ownerId !== req.user.id) {
      const membership = await prisma.sessionMember.findUnique({
        where: { userId_roomId: { userId: req.user.id, roomId: room.id } },
      });
      if (!membership) return res.status(403).json({ error: 'Access denied' });
    }

    const rows = await prisma.chatThread.findMany({
      where: {
        roomId: room.id,
        members: { some: { userId: req.user.id } },
      },
      include: {
        members: { include: { user: { select: { id: true, name: true, avatar: true, email: true } } } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    // Defense in depth: only return threads where the caller is genuinely a member.
    const threads = rows.filter((t) => t.members.some((m) => m.userId === req.user.id));

    res.json({ threads });
  } catch (err) {
    next(err);
  }
};

const leaveChatThread = async (req, res, next) => {
  try {
    const { id: roomId, threadId } = req.params;
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const thread = await prisma.chatThread.findFirst({
      where: { id: threadId, roomId: room.id },
      include: { members: { select: { userId: true } } },
    });
    if (!thread) return res.status(404).json({ error: 'Group not found' });

    const isMember = thread.members.some((m) => m.userId === req.user.id);
    if (!isMember) return res.status(403).json({ error: 'Not a member of this group' });

    await prisma.chatThreadMember.delete({
      where: { threadId_userId: { threadId, userId: req.user.id } },
    });

    const remaining = thread.members.filter((m) => m.userId !== req.user.id);
    if (remaining.length === 0) {
      await prisma.chatThread.delete({ where: { id: threadId } });
    }

    const { getIo } = require('../socket/ioInstance');
    const io = getIo();
    if (io) {
      io.to(`user:${req.user.id}`).emit('chat:threads:refresh', { roomId: room.id });
      for (const m of remaining) {
        io.to(`user:${m.userId}`).emit('chat:threads:refresh', { roomId: room.id });
      }
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

const deleteChatThread = async (req, res, next) => {
  try {
    const { id: roomId, threadId } = req.params;
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const thread = await prisma.chatThread.findFirst({
      where: { id: threadId, roomId: room.id },
      include: { members: { select: { userId: true } } },
    });
    if (!thread) return res.status(404).json({ error: 'Group not found' });

    if (thread.createdById !== req.user.id) {
      return res.status(403).json({ error: 'Only the group creator can delete it' });
    }

    const memberIds = thread.members.map((m) => m.userId);
    await prisma.chatThread.delete({ where: { id: threadId } });

    const { getIo } = require('../socket/ioInstance');
    const io = getIo();
    if (io) {
      for (const uid of memberIds) {
        io.to(`user:${uid}`).emit('chat:threads:refresh', { roomId: room.id });
      }
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

const createChatThread = async (req, res, next) => {
  try {
    const room = await prisma.room.findUnique({ where: { id: req.params.id } });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (room.ownerId !== req.user.id) {
      const membership = await prisma.sessionMember.findUnique({
        where: { userId_roomId: { userId: req.user.id, roomId: room.id } },
      });
      if (!membership) return res.status(403).json({ error: 'Access denied' });
    }

    const { memberUserIds, title } = z
      .object({
        memberUserIds: z.array(z.string().min(1)).min(1).max(24),
        title: z.string().max(120).optional(),
      })
      .parse(req.body);

    const memberSet = new Set([req.user.id, ...memberUserIds]);
    const allIds = [...memberSet];

    const allowed = new Set([room.ownerId]);
    const sm = await prisma.sessionMember.findMany({
      where: { roomId: room.id, leftAt: null },
      select: { userId: true },
    });
    sm.forEach((s) => allowed.add(s.userId));

    for (const uid of allIds) {
      if (!allowed.has(uid)) {
        return res.status(400).json({ error: 'Every member must be an active participant in this room' });
      }
    }

    const defaultTitle =
      title?.trim() ||
      `Group (${allIds.length})`;

    const thread = await prisma.chatThread.create({
      data: {
        roomId: room.id,
        createdById: req.user.id,
        title: defaultTitle,
        members: {
          create: allIds.map((userId) => ({ userId })),
        },
      },
      include: {
        members: { include: { user: { select: { id: true, name: true, avatar: true } } } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    const { getIo } = require('../socket/ioInstance');
    const io = getIo();
    if (io) {
      for (const uid of allIds) {
        io.to(`user:${uid}`).emit('chat:threads:refresh', { roomId: room.id });
      }
    }

    res.status(201).json(thread);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createRoom,
  listRooms,
  getRoom,
  getRoomByCode,
  deleteRoom,
  getRoomMessages,
  joinRoom,
  getRoomParticipants,
  listRoomChatThreads,
  createChatThread,
  leaveChatThread,
  deleteChatThread,
};
