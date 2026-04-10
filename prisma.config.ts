import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Load .env from project root
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'server/prisma/schema.prisma'),
  migrate: {
    url: dbUrl!,
  },
});
