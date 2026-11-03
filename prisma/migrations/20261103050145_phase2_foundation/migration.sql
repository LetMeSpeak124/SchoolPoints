-- CreateTable
CREATE TABLE "PointPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "maxAwardPoints" INTEGER NOT NULL,
    "studentDailyCap" INTEGER NOT NULL,
    "collectionWindowHours" INTEGER NOT NULL,
    "effectiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PointPolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonthlyAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "allocatedPoints" INTEGER NOT NULL,
    "usedPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonthlyAllocation_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Activity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" DATETIME,
    "activityId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Dispute_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Dispute_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Dispute_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "actorId" TEXT,
    "requestHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "response" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "expiresAt" DATETIME
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "runAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "lockedAt" DATETIME,
    "lockedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "windowStart" DATETIME NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME,

    PRIMARY KEY ("key", "windowStart")
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PointLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "note" TEXT,
    "awardedById" TEXT,
    "redemptionId" TEXT,
    "policyVersionId" TEXT,
    "activityId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PointLedger_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PointLedger_awardedById_fkey" FOREIGN KEY ("awardedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PointLedger_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "Redemption" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PointLedger_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PointPolicy" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PointLedger_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PointLedger" ("amount", "awardedById", "category", "createdAt", "id", "note", "redemptionId", "studentId", "type") SELECT "amount", "awardedById", "category", "createdAt", "id", "note", "redemptionId", "studentId", "type" FROM "PointLedger";
DROP TABLE "PointLedger";
ALTER TABLE "new_PointLedger" RENAME TO "PointLedger";
CREATE INDEX "PointLedger_studentId_idx" ON "PointLedger"("studentId");
CREATE INDEX "PointLedger_awardedById_idx" ON "PointLedger"("awardedById");
CREATE INDEX "PointLedger_type_idx" ON "PointLedger"("type");
CREATE INDEX "PointLedger_createdAt_idx" ON "PointLedger"("createdAt");
CREATE INDEX "PointLedger_redemptionId_idx" ON "PointLedger"("redemptionId");
CREATE TABLE "new_Redemption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "pointCost" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    "readyAt" DATETIME,
    "collectedById" TEXT,
    "collectedAt" DATETIME,
    "cancelledAt" DATETIME,
    "policyVersionId" TEXT,
    "activityId" TEXT,
    CONSTRAINT "Redemption_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Redemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Redemption_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Redemption_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PointPolicy" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Redemption_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Redemption" ("cancelledAt", "collectedAt", "collectedById", "createdAt", "expiresAt", "id", "pointCost", "readyAt", "rewardId", "status", "studentId", "updatedAt") SELECT "cancelledAt", "collectedAt", "collectedById", "createdAt", "expiresAt", "id", "pointCost", "readyAt", "rewardId", "status", "studentId", "updatedAt" FROM "Redemption";
DROP TABLE "Redemption";
ALTER TABLE "new_Redemption" RENAME TO "Redemption";
CREATE INDEX "Redemption_studentId_idx" ON "Redemption"("studentId");
CREATE INDEX "Redemption_rewardId_idx" ON "Redemption"("rewardId");
CREATE INDEX "Redemption_status_idx" ON "Redemption"("status");
CREATE INDEX "Redemption_expiresAt_idx" ON "Redemption"("expiresAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PointPolicy_version_key" ON "PointPolicy"("version");

-- CreateIndex
CREATE INDEX "PointPolicy_isActive_effectiveAt_idx" ON "PointPolicy"("isActive", "effectiveAt");

-- CreateIndex
CREATE INDEX "PointPolicy_createdById_idx" ON "PointPolicy"("createdById");

-- CreateIndex
CREATE INDEX "MonthlyAllocation_teacherId_period_idx" ON "MonthlyAllocation"("teacherId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyAllocation_teacherId_period_key" ON "MonthlyAllocation"("teacherId", "period");

-- CreateIndex
CREATE INDEX "Activity_createdById_idx" ON "Activity"("createdById");

-- CreateIndex
CREATE INDEX "Dispute_studentId_idx" ON "Dispute"("studentId");

-- CreateIndex
CREATE INDEX "Dispute_targetType_targetId_idx" ON "Dispute"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE INDEX "Dispute_resolvedById_idx" ON "Dispute"("resolvedById");

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_scope_key_actorId_key" ON "IdempotencyKey"("scope", "key", "actorId");

-- CreateIndex
CREATE INDEX "Job_status_runAt_idx" ON "Job"("status", "runAt");

-- CreateIndex
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");
