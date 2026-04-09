module.exports = {
  apps: [
    {
      name: 'summa-inventory',
      script: 'server/dist/index.js',
      cwd: '/var/www/summa-inventory',
      node_args: '--env-file=.env',
      env: {
        NODE_ENV: 'production',
        PORT: 3045,
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
