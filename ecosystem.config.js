module.exports = {
  apps: [
    {
      name: 'summa-inventory',
      script: 'server/dist/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3045,
      },
      env_file: '.env',
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M',
    },
  ],
};
