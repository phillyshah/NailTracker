#!/bin/bash
set -e

echo "=== Summa Inventory — VPS Setup ==="

cd /var/www/summa-inventory

# Load .env into shell environment
set -a
source .env
set +a

echo "Installing dependencies..."
npm install

echo "Generating Prisma client..."
npx prisma generate --schema=server/prisma/schema.prisma

echo "Running database migrations..."
npx prisma migrate deploy --schema=server/prisma/schema.prisma

echo "Seeding database..."
npm run db:seed --workspace=server

echo "Building application..."
npm run build

echo "Restarting PM2..."
pm2 restart summa-inventory 2>/dev/null || pm2 start ecosystem.config.js

echo "=== Setup complete! ==="
