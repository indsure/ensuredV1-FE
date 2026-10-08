// pm2 process for the WhatsApp bot. Separate from the backend so a WhatsApp crash never
// takes the portal down. Start: pm2 start ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: "indsure-wa-bot",
      cwd: __dirname,
      script: "node_modules/.bin/tsx",
      args: "src/index.ts",
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
      env: { NODE_ENV: "production" },
    },
  ],
};
