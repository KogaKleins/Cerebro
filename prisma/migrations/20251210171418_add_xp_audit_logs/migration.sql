-- CreateTable
CREATE TABLE "xp_audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceIdentifier" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "timestamp" TIMESTAMP(3) NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "reversedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "xp_audit_logs_userId_idx" ON "xp_audit_logs"("userId");

-- CreateIndex
CREATE INDEX "xp_audit_logs_sourceIdentifier_idx" ON "xp_audit_logs"("sourceIdentifier");

-- CreateIndex
CREATE INDEX "xp_audit_logs_status_idx" ON "xp_audit_logs"("status");

-- CreateIndex
CREATE INDEX "xp_audit_logs_timestamp_idx" ON "xp_audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "xp_audit_logs_source_idx" ON "xp_audit_logs"("source");
