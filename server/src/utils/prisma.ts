import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Must load env HERE before creating the pg Pool,
// because ESM hoists imports before index.ts dotenv.config() runs
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Use DIRECT_URL (port 5432) to avoid double-pooling with PgBouncer.
// Fall back to DATABASE_URL if DIRECT_URL is not set.
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  // Every query crosses the public internet to Supabase, so the defaults are a
  // poor fit. keepAlive stops idle sockets being silently reaped by NAT, which
  // otherwise shows up as "Connection terminated unexpectedly" on the first
  // request after a quiet period. The timeouts stop one slow query holding a
  // pool slot indefinitely.
  max: 10,
  keepAlive: true,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  statement_timeout: 30_000,
});
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
