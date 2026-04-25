const prisma = require('../config/db');
const { z } = require('zod');

const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, avatar: true, publicKey: true, emailVerified: true, createdAt: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
};

const updateMe = async (req, res, next) => {
  try {
    const { name, avatar } = z
      .object({ name: z.string().min(2).max(50).optional(), avatar: z.string().url().optional() })
      .parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { ...(name && { name }), ...(avatar && { avatar }) },
      select: { id: true, name: true, email: true, avatar: true, createdAt: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
};

const getStats = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [totalSessions, totalMessages, ownedRooms] = await Promise.all([
      prisma.sessionMember.count({ where: { userId } }),
      prisma.message.count({ where: { userId } }),
      prisma.room.count({ where: { ownerId: userId } }),
    ]);

    const sessions = await prisma.sessionMember.findMany({
      where: { userId, leftAt: { not: null } },
      select: { joinedAt: true, leftAt: true },
    });

    const totalMinutes = sessions.reduce((acc, s) => {
      return acc + Math.round((s.leftAt - s.joinedAt) / 60000);
    }, 0);

    res.json({ totalSessions, totalMessages, ownedRooms, totalMinutes });
  } catch (err) {
    next(err);
  }
};

const registerPublicKey = async (req, res, next) => {
  try {
    const { publicKey } = z
      .object({ publicKey: z.string().min(1).max(1000) })
      .parse(req.body);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { publicKey },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

module.exports = { getMe, updateMe, getStats, registerPublicKey };
