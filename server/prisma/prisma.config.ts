import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'schema.prisma'),
  migrate: {
    async url() {
      // Migrations need the direct connection (port 5432), not the pooler (6543)
      return process.env.DIRECT_URL || process.env.DATABASE_URL!;
    },
  },
});
