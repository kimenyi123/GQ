import { prisma } from "./prisma";

let dbReady: boolean | null = null;

export function isDatabaseConfigured() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url || url.startsWith("file:")) return false;
  if (/YOUR_PASSWORD|password=\s*;|password=$/i.test(url)) return false;
  return true;
}

export async function isDatabaseReady() {
  if (!isDatabaseConfigured()) {
    dbReady = false;
    return false;
  }
  if (dbReady !== null) return dbReady;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbReady = true;
  } catch {
    dbReady = false;
  }
  return dbReady;
}

export function resetDatabaseReadyCache() {
  dbReady = null;
}
