-- CreateTable
CREATE TABLE "PixCharge" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "qrCode" TEXT NOT NULL,
    "qrBase64" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PixCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PixCharge_paymentId_key" ON "PixCharge"("paymentId");

-- CreateIndex
CREATE INDEX "PixCharge_orderId_kind_idx" ON "PixCharge"("orderId", "kind");

-- AddForeignKey
ALTER TABLE "PixCharge" ADD CONSTRAINT "PixCharge_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
