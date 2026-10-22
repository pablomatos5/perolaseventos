-- Vendidos fora do site (presencial): ocupam vaga no lote e contam na barra "% vendido", sem entrar na receita
ALTER TABLE "Batch" ADD COLUMN "soldOffline" INTEGER NOT NULL DEFAULT 0;
