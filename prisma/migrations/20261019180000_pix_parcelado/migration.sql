-- Pix em 2x: plano de pagamento no pedido, status da 1ª parcela paga e configuração por evento
ALTER TYPE "OrderStatus" ADD VALUE 'PARTIAL';
CREATE TYPE "PaymentPlan" AS ENUM ('FULL', 'PIX_2X');
ALTER TABLE "Event" ADD COLUMN "splitPixEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "splitPixDays" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "Order" ADD COLUMN "paymentPlan" "PaymentPlan" NOT NULL DEFAULT 'FULL',
  ADD COLUMN "firstPaidCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "firstPaidAt" TIMESTAMP(3),
  ADD COLUMN "firstPaymentRef" TEXT;
