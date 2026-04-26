const prisma = require('../config/db');
const logger = require('../utils/logger');

/** Legacy Neon / Stack Auth RS256 */
const syncUser = async (decoded) => {
  const stackAuthId = decoded.sub;
  logger.debug(`[syncUser] stackAuthId=${stackAuthId}`);

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
    logger.info(`[syncUser] created new user id=${user.id} email=${user.email}`);
  }
  return user;
};

/**
 * Supabase Auth — `sub` is auth.users UUID.
 * Lookup order: supabaseUserId → email (migration-friendly) → create new.
 */
const syncSupabaseUser = async (decoded) => {
  const supabaseUserId = decoded.sub;
  if (!supabaseUserId) throw new Error('Missing sub in Supabase JWT');

  const email =
    (typeof decoded.email === 'string' && decoded.email) ||
    (decoded.user_metadata?.email) ||
    null;

  logger.debug(`[syncSupabaseUser] sub=${supabaseUserId} email=${email}`);

  // 1) Already linked
  let user = await prisma.user.findUnique({ where: { supabaseUserId } });
  if (user) {
    logger.debug(`[syncSupabaseUser] found by supabaseUserId id=${user.id}`);
    return user;
  }

  if (!email) throw new Error('Supabase JWT has no email — cannot create user');

  // 2) Same email exists (email/password user now signing in with Google)
  const existingByEmail = await prisma.user.findUnique({ where: { email } });
  if (existingByEmail) {
    logger.info(`[syncSupabaseUser] linking existing email user id=${existingByEmail.id} to supabaseUserId=${supabaseUserId}`);
    user = await prisma.user.update({
      where: { id: existingByEmail.id },
      data: { supabaseUserId },
    });
    return user;
  }

  // 3) Brand-new user
  const name =
    decoded.user_metadata?.full_name ||
    decoded.user_metadata?.name ||
    email.split('@')[0] ||
    'User';
  const avatar =
    decoded.user_metadata?.avatar_url ||
    decoded.user_metadata?.picture ||
    null;

  user = await prisma.user.create({
    data: { supabaseUserId, email, name, avatar },
  });
  logger.info(`[syncSupabaseUser] created new user id=${user.id} email=${user.email}`);
  return user;
};

module.exports = { syncUser, syncSupabaseUser };
