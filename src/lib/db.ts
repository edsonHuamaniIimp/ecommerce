import { PrismaClient } from "../../prisma/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL no definida");

  const pool = new Pool({ connectionString, max: 10 });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

let _prisma: PrismaClient | undefined;

function getPrisma(): PrismaClient {
  if (_prisma) return _prisma;
  _prisma = globalForPrisma.prisma ?? createPrismaClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = _prisma;
  return _prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop: string) {
    const client = getPrisma();
    const value = (client as unknown as Record<string, unknown>)[prop];
    if (typeof value === "function") return value.bind(client);
    return value;
  },
});
