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

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
