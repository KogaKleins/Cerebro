-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "replyToAuthor" TEXT,
ADD COLUMN     "replyToId" TEXT,
ADD COLUMN     "replyToText" TEXT;

-- CreateIndex
CREATE INDEX "messages_replyToId_idx" ON "messages"("replyToId");
