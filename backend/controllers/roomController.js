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

    // Only the owner or a session member can read messages
    if (room.ownerId !== req.user.id) {
      const membership = await prisma.sessionMember.findUnique({
        where: { userId_roomId: { userId: req.user.id, roomId: room.id } },
      });
      if (!membership) return res.status(403).json({ error: 'Access denied' });
    }

    const { cursor, limit = 50 } = req.query;
    const safeLimit = Math.min(parseInt(limit) || 50, 100);
    const messages = await prisma.message.findMany({
      where: { roomId: req.params.id },
      include: { user: { select: { id: true, name: true, avatar: true, publicKey: true } } },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });
    res.json(messages.reverse());
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

const getRoomMemberKeys = async (req, res, next) => {
  try {
    const room = await prisma.room.findUnique({ where: { id: req.params.id } });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (room.ownerId !== req.user.id) {
      const membership = await prisma.sessionMember.findUnique({
        where: { userId_roomId: { userId: req.user.id, roomId: room.id } },
      });
      if (!membership) return res.status(403).json({ error: 'Access denied' });
    }

    const members = await prisma.sessionMember.findMany({
      where: { roomId: room.id },
      select: { userId: true, user: { select: { publicKey: true } } },
      distinct: ['userId'],
    });

    res.json(
      members
        .filter((m) => m.user.publicKey)
        .map((m) => ({ userId: m.userId, publicKey: m.user.publicKey }))
    );
  } catch (err) {
    next(err);
  }
};

module.exports = { createRoom, listRooms, getRoom, getRoomByCode, deleteRoom, getRoomMessages, joinRoom, getRoomMemberKeys };
