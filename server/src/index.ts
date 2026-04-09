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

import authRoutes from './routes/auth.js';
import inventoryRoutes from './routes/inventory.js';
import distributorRoutes from './routes/distributors.js';
import reportRoutes from './routes/reports.js';
import userRoutes from './routes/users.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3045', 10);

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? true : 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/distributors', distributorRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// Serve client build in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('{*path}', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
