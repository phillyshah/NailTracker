import { defineConfig } from 'vitest/config';

// Standalone Vitest config for the client. Kept separate from vite.config.ts so
// unit tests don't pull in the React/Tailwind dev plugins — the date logic
// under test is pure TypeScript. Run a single timezone with e.g.
//   TZ=America/New_York npm test --workspace=client
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
