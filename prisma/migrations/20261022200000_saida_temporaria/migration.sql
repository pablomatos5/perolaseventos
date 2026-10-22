-- Saída temporária na portaria: o mesmo QR volta a valer para uma reentrada (limite no código)
ALTER TABLE "Ticket" ADD COLUMN "exitCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Ticket" ADD COLUMN "lastExitAt" TIMESTAMP(3);
