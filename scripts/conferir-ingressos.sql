-- Conferência de integridade dos ingressos (rodar antes e durante o evento; cada linha deve dar 0).
-- Na VPS:  docker exec -i perolas-db sh -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB' < scripts/conferir-ingressos.sql
\pset format unaligned
\pset fieldsep ' | '
\pset tuples_only on

SELECT 'ingresso VÁLIDO em pedido que não está pago', count(*) FROM "Ticket" t JOIN "Order" o ON o.id = t."orderId" WHERE t.status = 'VALID' AND o.status <> 'PAID';
SELECT 'ingresso só reservado em pedido pago (não passaria na portaria)', count(*) FROM "Ticket" t JOIN "Order" o ON o.id = t."orderId" WHERE t.status = 'RESERVED' AND o.status = 'PAID';
SELECT 'ingresso ainda válido em pedido estornado/cancelado', count(*) FROM "Ticket" t JOIN "Order" o ON o.id = t."orderId" WHERE t.status = 'VALID' AND o.status IN ('REFUNDED','CANCELED','EXPIRED');
SELECT 'pedido de demonstração (pagamento simulado) com ingresso válido', count(*) FROM "Ticket" t JOIN "Order" o ON o.id = t."orderId" WHERE t.status = 'VALID' AND o."paymentRef" LIKE 'mock\_%' ESCAPE '\';
SELECT 'mesmo pagamento do Mercado Pago em dois pedidos', count(*) FROM (SELECT "paymentRef" FROM "Order" WHERE "paymentRef" ~ '^[0-9]+$' GROUP BY 1 HAVING count(*) > 1) d;
SELECT 'pedido pago sem nenhum ingresso', count(*) FROM "Order" o WHERE o.status = 'PAID' AND NOT EXISTS (SELECT 1 FROM "Ticket" t WHERE t."orderId" = o.id);
SELECT 'pedido pago sem e-mail enviado com sucesso', count(*) FROM "Order" o WHERE o.status = 'PAID' AND o."totalCents" > 0 AND NOT EXISTS (SELECT 1 FROM "Delivery" d WHERE d."orderId" = o.id AND d.ok);
SELECT 'lote com mais ingressos ocupados do que a quantidade', count(*) FROM "Batch" b WHERE b."soldOffline" + (SELECT count(*) FROM "Ticket" t JOIN "Order" o ON o.id = t."orderId" WHERE t."batchId" = b.id AND (t.status = 'VALID' OR (t.status = 'RESERVED' AND o.status IN ('PENDING','PARTIAL') AND o."expiresAt" > now()))) > b.quantity;
SELECT 'ingresso pago sem gênero (fora cortesia)', count(*) FROM "Ticket" t JOIN "Order" o ON o.id = t."orderId" WHERE t.status = 'VALID' AND t.gender IS NULL AND t."priceCents" > 0;
SELECT 'entrada registrada em ingresso não válido', count(*) FROM "Ticket" WHERE "usedAt" IS NOT NULL AND status <> 'VALID';

\pset tuples_only off
SELECT 'RESUMO' AS x, (SELECT count(*) FROM "Order" WHERE status = 'PAID') AS pedidos_pagos, (SELECT count(*) FROM "Ticket" WHERE status = 'VALID') AS ingressos_validos,
  (SELECT count(*) FROM "Ticket" WHERE "usedAt" IS NOT NULL) AS entradas, (SELECT count(*) FROM "PortariaDevice" WHERE "revokedAt" IS NULL) AS aparelhos_autorizados;
