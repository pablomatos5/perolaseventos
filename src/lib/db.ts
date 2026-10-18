import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // O Postgres embutido do `prisma dev` derruba conexões simultâneas: em dev usamos DATABASE_POOL_MAX=1
  // (as consultas entram em fila). Em produção, com Postgres de verdade, o padrão de 10 conexões vale.
  const max = Number(process.env.DATABASE_POOL_MAX ?? 20);
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, max });
  return new PrismaClient({ adapter });
}

// Reaproveita o cliente entre recarregamentos do `next dev` para não abrir conexões sem fim.
export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
