/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

const devPort = Number(process.env.VITE_PORT ?? '5173');
const devHost = process.env.VITE_HOST ?? 'localhost';
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000';
const watchInterval = Number(process.env.CHOKIDAR_INTERVAL ?? '1000');
const usePolling = process.env.CHOKIDAR_USEPOLLING === 'true';
const hmrClientPort = process.env.VITE_HMR_CLIENT_PORT ? Number(process.env.VITE_HMR_CLIENT_PORT) : undefined;

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/web',
  envPrefix: 'VITE_',
  server: {
    port: devPort,
    host: devHost,
    watch: usePolling
      ? {
          usePolling: true,
          interval: watchInterval,
        }
      : undefined,
    hmr:
      process.env.VITE_HMR_HOST || hmrClientPort
        ? {
            host: process.env.VITE_HMR_HOST,
            clientPort: hmrClientPort,
          }
        : undefined,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: devPort,
    host: devHost,
  },
  plugins: [react(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  // Uncomment this if you are using workers.
  // worker: {
  //   plugins: () => [ nxViteTsPaths() ],
  // },
  build: {
    outDir: '../../dist/apps/web',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: '../../coverage/apps/web',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.spec.{ts,tsx}',
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.d.ts',
      ],
    },
  },
}));
