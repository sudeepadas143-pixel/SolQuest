import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// On Vercel, api/*.js are serverless functions. Locally (vite dev / preview)
// this serves the same handlers, backed by the in-memory store unless Upstash
// env vars are set - so the leaderboard works offline and in the test scripts.
function localApi() {
  const attach = (server) => {
    process.env.LEADERBOARD_MEMORY ??= '1';
    process.env.ADMIN_KEY ??= 'local-admin';
    server.middlewares.use(async (req, res, next) => {
      const m = /^\/api\/(leaderboard|player|runs|admin)(?:\?|$)/.exec(req.url ?? '');
      if (!m) return next();
      let raw = '';
      for await (const chunk of req) raw += chunk;
      try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
      const file = fileURLToPath(new URL(`./api/${m[1]}.js`, import.meta.url));
      const { default: handler } = await import(file);
      await handler(req, res);
    });
  };
  return { name: 'local-api', configureServer: attach, configurePreviewServer: attach };
}

export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: { chunkSizeWarningLimit: 2000 },
  plugins: [localApi()],
});
