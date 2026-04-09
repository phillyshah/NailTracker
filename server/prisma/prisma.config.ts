import dotenv from 'dotenv';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Load .env from project root (two levels up from server/prisma/)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'schema.prisma'),
  migrate: {
    async url() {
      return process.env.DIRECT_URL || process.env.DATABASE_URL!;
    },
  },
});
