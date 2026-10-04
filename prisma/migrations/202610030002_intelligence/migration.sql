-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "confidence" INTEGER,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'Manual',
ADD COLUMN     "sourceEmailId" TEXT;

-- CreateTable
CREATE TABLE "EmailConnection" (
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'google',
    "account" TEXT NOT NULL DEFAULT '',
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "state" TEXT NOT NULL DEFAULT 'connected',

    CONSTRAINT "EmailConnection_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "OAuthAttempt" (
    "state" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verifier" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthAttempt_pkey" PRIMARY KEY ("state")
);

-- CreateTable
CREATE TABLE "EmailMessageMetadata" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "company" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT '',
    "confidence" INTEGER NOT NULL,
    "reasons" JSONB NOT NULL,
    "applicationId" TEXT,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailMessageMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestedAction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "decision" TEXT NOT NULL DEFAULT 'pending',
    "decidedAt" TIMESTAMP(3),
    "resultId" TEXT,

    CONSTRAINT "SuggestedAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSkill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "proficiency" TEXT NOT NULL,

    CONSTRAINT "UserSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchProfile" (
    "userId" TEXT NOT NULL,
    "experienceYears" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "education" TEXT NOT NULL DEFAULT '',
    "staleDays" INTEGER NOT NULL DEFAULT 21,

    CONSTRAINT "SearchProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "pageToken" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "requestedAt" TIMESTAMP(3),
    "leaseUntil" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "retryAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "EmailMessageMetadata_userId_receivedAt_idx" ON "EmailMessageMetadata"("userId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessageMetadata_userId_externalId_key" ON "EmailMessageMetadata"("userId", "externalId");

-- CreateIndex
CREATE INDEX "SuggestedAction_decision_idx" ON "SuggestedAction"("decision");

-- CreateIndex
CREATE UNIQUE INDEX "SuggestedAction_messageId_kind_key" ON "SuggestedAction"("messageId", "kind");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_key_key" ON "Notification"("userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "UserSkill_userId_name_key" ON "UserSkill"("userId", "name");

-- AddForeignKey
ALTER TABLE "EmailConnection" ADD CONSTRAINT "EmailConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAttempt" ADD CONSTRAINT "OAuthAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessageMetadata" ADD CONSTRAINT "EmailMessageMetadata_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessageMetadata" ADD CONSTRAINT "EmailMessageMetadata_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestedAction" ADD CONSTRAINT "SuggestedAction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "EmailMessageMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkill" ADD CONSTRAINT "UserSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchProfile" ADD CONSTRAINT "SearchProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncState" ADD CONSTRAINT "SyncState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
