-- AlterTable: User gets a nullable publicKey for E2E chat.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "publicKey" TEXT;

-- AlterTable: Message gets optional encryption fields.
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "iv" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "recipientKeys" JSONB;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "encrypted" BOOLEAN NOT NULL DEFAULT false;
