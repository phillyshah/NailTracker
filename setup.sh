#!/bin/bash
set -e

echo "=== Summa Inventory — VPS Setup ==="

cd /var/www/summa-inventory

echo "Installing dependencies (including dev for build)..."
npm install --include=dev

echo "Generating Prisma client..."
npx prisma generate --schema=server/prisma/schema.prisma

# Load .env for seed and migrate commands
set -a
source .env
set +a

echo "Running database migrations..."
npx prisma migrate deploy --schema=server/prisma/schema.prisma || echo "Migration skipped (tables may already exist)"

echo "Seeding database..."
npm run db:seed --workspace=server

echo "Building application..."
npm run build

echo "Restarting PM2..."
pm2 restart summa-inventory 2>/dev/null || pm2 start ecosystem.config.js

echo "=== Setup complete! ==="
