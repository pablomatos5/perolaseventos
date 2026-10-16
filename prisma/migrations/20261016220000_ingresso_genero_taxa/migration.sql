-- Sai a meia-entrada; entram ingresso masculino/feminino e a taxa de serviço por ingresso.
CREATE TYPE "TicketGender" AS ENUM ('MASCULINO', 'FEMININO');

ALTER TABLE "Ticket" ADD COLUMN "gender" "TicketGender";
-- ingressos já vendidos (todos de teste até aqui) ficam como masculino; cortesias (preço 0) sem gênero
UPDATE "Ticket" SET "gender" = 'MASCULINO' WHERE "priceCents" > 0;
ALTER TABLE "Ticket" DROP COLUMN "isHalf";

ALTER TABLE "Batch" RENAME COLUMN "halfPriceCents" TO "femalePriceCents";
UPDATE "Batch" SET "femalePriceCents" = NULL;

ALTER TABLE "TicketType" DROP COLUMN "allowHalfPrice";

ALTER TABLE "Order" ADD COLUMN "feeCents" INTEGER NOT NULL DEFAULT 0;
