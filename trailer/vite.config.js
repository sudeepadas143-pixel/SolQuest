// The trailer is its own Vite app, but it reads straight from the game:
//   /assets/...   -> the game's public/ folder (sprites, tiles)
//   @game/...     -> the game's src/ (UI skin, palette, font, SFX synth, data)
// so every sprite, colour, font and sound effect in the trailer is the game's.
import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, '..');

export default defineConfig({
  root: HERE,
  publicDir: path.join(GAME, 'public'),
  resolve: { alias: { '@game': path.join(GAME, 'src') } },
  server: { port: 5174, strictPort: true, host: '127.0.0.1', fs: { allow: [GAME] } },
  build: { outDir: 'dist', rollupOptions: { input: { index: path.join(HERE, 'index.html'), render: path.join(HERE, 'render.html') } } },
});
