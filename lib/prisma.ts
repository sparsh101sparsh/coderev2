import { PrismaClient } from '@prisma/client';

/**
 * The Prisma schema uses PostgreSQL. Keep the connection URL explicit so a
 * misconfigured deployment fails clearly instead of silently using ephemeral
 * serverless storage.
 */
function getDbUrl(): string {
  const envUrl = process.env.DATABASE_URL?.trim();
  if (!envUrl) {
    return '';
  }
  if (!envUrl.startsWith('postgresql://') && !envUrl.startsWith('postgres://')) {
    return envUrl;
  }
  try {
    const url = new URL(envUrl);
    if (!url.searchParams.has('connection_limit')) {
      const configuredLimit = Number.parseInt(process.env.PRISMA_CONNECTION_LIMIT || '2', 10);
      const connectionLimit = Number.isFinite(configuredLimit)
        ? Math.max(1, Math.min(10, configuredLimit))
        : 2;
      url.searchParams.set('connection_limit', String(connectionLimit));
    }
    if (!url.searchParams.has('connect_timeout')) {
      url.searchParams.set('connect_timeout', '10');
    }
    if (process.env.PRISMA_PGBOUNCER === 'true' && !url.searchParams.has('pgbouncer')) {
      url.searchParams.set('pgbouncer', 'true');
    }
    return url.toString();
  } catch {
    return envUrl;
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const dbUrl = getDbUrl();
  return new PrismaClient({
    datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Always persist singleton on globalThis to prevent multiple instances
// across hot-reload (dev) AND across serverless warm containers (production).
globalForPrisma.prisma = prisma;

export default prisma;
