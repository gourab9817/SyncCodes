-- Chat threads: everyone (ROOM) vs private (PRIVATE + dmThreadKey)
ALTER TABLE "Message" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'ROOM';
ALTER TABLE "Message" ADD COLUMN "dmThreadKey" TEXT;
CREATE INDEX "Message_room_scope_thread_idx" ON "Message"("roomId", "scope", "dmThreadKey");
