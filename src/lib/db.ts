import { PrismaClient } from "@prisma/client";
import path from "path";
import os from "os";
import fs from "fs";

export function getDatabasePath(): string {
  const freerouteDir = path.join(os.homedir(), ".freeroute");
  if (!fs.existsSync(freerouteDir)) {
    try { fs.mkdirSync(freerouteDir, { recursive: true }); } catch {}
  }
  return path.join(freerouteDir, "freeroute.db");
}

export function getDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl && !envUrl.includes("./dev.db") && !envUrl.includes("~")) {
    return envUrl;
  }
  const defaultUrl = `file:${getDatabasePath().replace(/\\/g, "/")}`;
  process.env.DATABASE_URL = defaultUrl;
  return defaultUrl;
}

const activeDbUrl = getDatabaseUrl();
process.env.DATABASE_URL = activeDbUrl;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrl(),
    },
  },
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Ensure RequestLog has 'app', 'errorMessage', 'promptHash', 'cacheHit' columns in SQLite
prisma
  .$executeRawUnsafe('ALTER TABLE "RequestLog" ADD COLUMN "app" TEXT DEFAULT \'Unknown\'')
  .catch(() => {});
prisma
  .$executeRawUnsafe('ALTER TABLE "RequestLog" ADD COLUMN "errorMessage" TEXT DEFAULT \'\'')
  .catch(() => {});
prisma
  .$executeRawUnsafe('ALTER TABLE "RequestLog" ADD COLUMN "promptHash" TEXT DEFAULT \'\'')
  .catch(() => {});
prisma
  .$executeRawUnsafe('ALTER TABLE "RequestLog" ADD COLUMN "cacheHit" BOOLEAN DEFAULT 0')
  .catch(() => {});

// Ensure ApiKey has budget, rate limit, and webhook columns in SQLite
prisma
  .$executeRawUnsafe('ALTER TABLE "ApiKey" ADD COLUMN "rpmLimit" INTEGER')
  .catch(() => {});
prisma
  .$executeRawUnsafe('ALTER TABLE "ApiKey" ADD COLUMN "tpmLimit" INTEGER')
  .catch(() => {});
prisma
  .$executeRawUnsafe('ALTER TABLE "ApiKey" ADD COLUMN "dailyBudget" REAL')
  .catch(() => {});
prisma
  .$executeRawUnsafe('ALTER TABLE "ApiKey" ADD COLUMN "monthlyBudget" REAL')
  .catch(() => {});
prisma
  .$executeRawUnsafe('ALTER TABLE "ApiKey" ADD COLUMN "webhookUrl" TEXT')
  .catch(() => {});
prisma
  .$executeRawUnsafe('ALTER TABLE "ApiKey" ADD COLUMN "webhookSecret" TEXT')
  .catch(() => {});

