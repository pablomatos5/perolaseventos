-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "cardFeeBps" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MpAccount" (
    "id" TEXT NOT NULL DEFAULT 'principal',
    "mpUserId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL DEFAULT '',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL DEFAULT '',
    "liveMode" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MpAccount_pkey" PRIMARY KEY ("id")
);
