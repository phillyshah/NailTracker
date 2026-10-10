import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';

import authRoutes from './routes/auth.js';
import inventoryRoutes from './routes/inventory.js';
import distributorRoutes from './routes/distributors.js';
import reportRoutes from './routes/reports.js';
import userRoutes from './routes/users.js';
import transferRoutes from './routes/transfers.js';
import bankRoutes from './routes/banks.js';
import usageRoutes from './routes/usage.js';
import parLevelRoutes from './routes/parlevels.js';
import orderPlanRoutes from './routes/orderplan.js';
import auditRoutes from './routes/audits.js';
import backupRoutes from './routes/backup.js';
import holdingsRoutes from './routes/holdings.js';
import ocrTrainingRoutes from './routes/ocr-training.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3045', 10);

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
// gzip every text response. The client bundle alone goes 969 kB -> 262 kB, and
// the report endpoints return highly repetitive JSON that compresses just as
// well. xlsx exports are skipped automatically (not a compressible MIME type),
// so the ExcelJS routes don't pay CPU to re-compress an already-zipped file.
app.use(compression());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? true : 'http://localhost:5173',
  credentials: true,
}));
// Default body limit stays small. Only the two routes that legitimately receive
// a base64 image or spreadsheet get the 10mb headroom — mounting that globally
// let any endpoint buffer and JSON.parse 10mb on a single-process server.
app.use('/api/ocr-training', express.json({ limit: '10mb' }));
app.use('/api/inventory/parse-spreadsheet', express.json({ limit: '10mb' }));
app.use(express.json());
app.use(cookieParser());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/distributors', distributorRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/banks', bankRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/par-levels', parLevelRoutes);
app.use('/api/order-plan', orderPlanRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/holdings', holdingsRoutes);
app.use('/api/ocr-training', ocrTrainingRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// Serve client build in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '../../client/dist');

  // Vite content-hashes everything under /assets, so a given URL's bytes can
  // never change — cache it for a year and skip revalidation entirely.
  app.use('/assets', express.static(path.join(clientDist, 'assets'), {
    maxAge: '1y',
    immutable: true,
  }));

  // manifest.json and the icons come from client/public and are NOT hashed,
  // so they must stay revalidatable — a short TTL only.
  app.use(express.static(clientDist, { maxAge: '1h', index: false }));

  // The SPA entry must never be cached, or a deploy appears not to land.
  app.get('{*path}', (_req, res) => {
    res.set('Cache-Control', 'no-cache, must-revalidate');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
