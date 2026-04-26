-- Covering indexes for hot chat query paths (roomMessages + thread history).
-- Both queries fetch the latest N rows ordered by createdAt and benefit from
-- having createdAt in the index leaf so we avoid a sort step at scale.

CREATE INDEX IF NOT EXISTS "Message_roomId_scope_createdAt_idx"
  ON "Message" ("roomId", "scope", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Message_threadId_createdAt_idx"
  ON "Message" ("threadId", "createdAt" DESC);

-- ChatThreadMember by user (already exists as ChatThreadMember_userId_idx
-- in 20260426120000), but adding a composite for the listRoomChatThreads
-- "find all threads in room R where I'm a member" query.
CREATE INDEX IF NOT EXISTS "ChatThreadMember_userId_threadId_idx"
  ON "ChatThreadMember" ("userId", "threadId");
