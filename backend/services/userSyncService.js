const prisma = require('../config/db');

const syncUser = async (decoded) => {
  const stackAuthId = decoded.sub;

  let user = await prisma.user.findUnique({ where: { stackAuthId } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        stackAuthId,
        email: decoded.email || `${stackAuthId}@neon.auth`,
        name: decoded.name || decoded.email?.split('@')[0] || 'User',
        avatar: decoded.picture || null,
      },
    });
  }

  return user;
};

module.exports = { syncUser };
