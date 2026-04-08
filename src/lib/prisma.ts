import { PrismaClient } from '../generated/prisma';
import { getEnv } from '../schemas/env';

const env = getEnv();
const databaseUrl = env.DATABASE_URL;

// Create a single PrismaClient instance shared across the app.
// This avoids exhausting DB connections in dev with HMR.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Case: DATABASE_URL is not set, throw early
if (!databaseUrl || databaseUrl.length === 0) {
  throw new Error(
    'DATABASE_URL is not set. Ensure root .env is present or provide it via environment.'
  );
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

// Cache the client in development for hot-reloads
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
