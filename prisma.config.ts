import path from 'node:path';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'server/prisma/schema.prisma'),
  migrate: {
    async url() {
      const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
      if (!url) {
        throw new Error('DIRECT_URL or DATABASE_URL must be set in .env');
      }
      return url;
    },
  },
});
