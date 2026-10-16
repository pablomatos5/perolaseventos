-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "checkinMethod" TEXT,
ADD COLUMN     "qrVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PortariaDevice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "PortariaDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PortariaDevice_tokenHash_key" ON "PortariaDevice"("tokenHash");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");
