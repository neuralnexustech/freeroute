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

function getDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl && !envUrl.includes("./dev.db")) {
    return envUrl;
  }
  return `file:${getDatabasePath().replace(/\\/g, "/")}`;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrl(),
    },
  },
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Ensure RequestLog has 'app' and 'errorMessage' columns in SQLite
prisma
  .$executeRawUnsafe('ALTER TABLE "RequestLog" ADD COLUMN "app" TEXT DEFAULT \'Unknown\'')
  .catch(() => {});
prisma
  .$executeRawUnsafe('ALTER TABLE "RequestLog" ADD COLUMN "errorMessage" TEXT DEFAULT \'\'')
  .catch(() => {});

