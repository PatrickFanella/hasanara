import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// In production nginx mounts ../branding/assets at /branding (docker-compose.web.yml).
// The development server serves the same files so the profile's logo, favicon and
// social card render locally instead of falling back to the SPA shell.
function clientBrandingAssets(): Plugin {
  const assets = fileURLToPath(new URL('../branding/assets/', import.meta.url));
  return {
    name: 'hasanara-client-branding-assets',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/branding', (req, res, next) => {
        const name = path.basename(decodeURIComponent((req.url ?? '').split('?')[0]));
        const file = path.join(assets, name);
        if (!name || !file.startsWith(assets) || !existsSync(file) || !statSync(file).isFile())
          return next();
        res.setHeader(
          'Content-Type',
          name.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream'
        );
        res.setHeader('Cache-Control', 'no-cache');
        createReadStream(file).pipe(res);
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(() => {
  const apiBase = process.env.VITE_API_BASE;
  const proxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:41177';
  return {
    build: { rollupOptions: { input: { main: 'index.html', at: 'at.html' } } },
    plugins: [react(), tailwindcss(), clientBrandingAssets()],
    server: {
      proxy: apiBase
        ? undefined
        : {
            '/api': {
              target: proxyTarget,
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/api/, ''),
            },
          },
    },
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: './src/tests/setup.ts',
      coverage: {
        provider: 'v8',
        reportsDirectory: '.artifacts/coverage',
        reporter: ['text'],
        exclude: [
          'node_modules/',
          'src/tests/',
          '**/*.test.{ts,tsx}',
          '**/*.spec.{ts,tsx}',
          '**/types/',
          'vite.config.ts',
          'eslint.config.js',
        ],
        thresholds: {
          lines: 65,
          functions: 65,
          branches: 50,
          statements: 65,
        },
      },
    },
  };
});
