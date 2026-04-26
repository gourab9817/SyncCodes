-- AlterTable
ALTER TABLE "SessionMember" ADD COLUMN "admittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ChatThread" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatThreadMember" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatThreadMember_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "threadId" TEXT;

-- CreateIndex
CREATE INDEX "ChatThread_roomId_updatedAt_idx" ON "ChatThread"("roomId", "updatedAt");

-- CreateIndex
CREATE INDEX "ChatThreadMember_userId_idx" ON "ChatThreadMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatThreadMember_threadId_userId_key" ON "ChatThreadMember"("threadId", "userId");

-- CreateIndex
CREATE INDEX "Message_roomId_threadId_idx" ON "Message"("roomId", "threadId");

-- CreateIndex
CREATE INDEX "SessionMember_roomId_leftAt_idx" ON "SessionMember"("roomId", "leftAt");

-- AddForeignKey
ALTER TABLE "ChatThread" ADD CONSTRAINT "ChatThread_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatThread" ADD CONSTRAINT "ChatThread_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatThreadMember" ADD CONSTRAINT "ChatThreadMember_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatThreadMember" ADD CONSTRAINT "ChatThreadMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message" ADD CONSTRAINT "Message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
