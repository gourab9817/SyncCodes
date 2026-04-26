-- Idempotent: init (20260423124726) already includes password + emailVerified on current path.
-- Older branches expected these here; stackAuthId is added if missing (init used googleId only).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "password" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stackAuthId" TEXT;
ALTER TABLE "User" ALTER COLUMN "stackAuthId" DROP NOT NULL;
