CREATE TYPE "InAppCallStatus" AS ENUM ('RINGING', 'CONNECTED', 'ENDED', 'REJECTED', 'FAILED');
CREATE TYPE "InAppCallSide" AS ENUM ('CALLER', 'CALLEE');

CREATE TABLE "in_app_call_sessions" (
    "id" TEXT NOT NULL,
    "callerCallId" TEXT NOT NULL,
    "calleeCallId" TEXT NOT NULL,
    "callerUserId" TEXT NOT NULL,
    "callerBusinessId" TEXT NOT NULL,
    "calleeBusinessId" TEXT NOT NULL,
    "callerNumber" TEXT NOT NULL,
    "calleeNumber" TEXT NOT NULL,
    "offer" JSONB NOT NULL,
    "answer" JSONB,
    "status" "InAppCallStatus" NOT NULL DEFAULT 'RINGING',
    "connectedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "in_app_call_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "in_app_call_candidates" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "side" "InAppCallSide" NOT NULL,
    "candidate" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "in_app_call_candidates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "in_app_call_sessions_callerCallId_key" ON "in_app_call_sessions"("callerCallId");
CREATE UNIQUE INDEX "in_app_call_sessions_calleeCallId_key" ON "in_app_call_sessions"("calleeCallId");
CREATE INDEX "in_app_call_sessions_callerBusinessId_status_idx" ON "in_app_call_sessions"("callerBusinessId", "status");
CREATE INDEX "in_app_call_sessions_calleeBusinessId_status_idx" ON "in_app_call_sessions"("calleeBusinessId", "status");
CREATE INDEX "in_app_call_candidates_sessionId_side_idx" ON "in_app_call_candidates"("sessionId", "side");

ALTER TABLE "in_app_call_candidates"
ADD CONSTRAINT "in_app_call_candidates_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "in_app_call_sessions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
