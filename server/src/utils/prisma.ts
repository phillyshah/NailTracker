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
});
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
