import { defineConfig, type Plugin } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { STATIC_BOARD_SAVE_ENDPOINT } from './src/services/dev/static-board-save-endpoint';
import { BOARD_MODEL_SAVE_ENDPOINT } from './src/services/dev/board-model-save-endpoint';

const boardsContentDir = path.resolve(__dirname, '../../packages/engine/src/content/boards');

interface DevFileSaveResult {
  status: number;
  body: unknown;
  fileName?: string;
  fileContent?: string;
}

function devFileSavePlugin(options: {
  name: string;
  endpoint: string;
  handlerModule: string;
  handlerExport: string;
  targetDir: string;
}): Plugin {
  return {
    name: options.name,
    configureServer(server) {
      server.middlewares.use(options.endpoint, (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }

        let rawBody = '';
        req.on('data', (chunk) => {
          rawBody += chunk;
        });
        req.on('end', () => {
          void (async () => {
            const handlerModule = await server.ssrLoadModule(options.handlerModule);
            const handle = handlerModule[options.handlerExport] as (
              rawBody: string,
            ) => DevFileSaveResult;
            const result = handle(rawBody);

            if (result.fileName && result.fileContent) {
              writeFileSync(path.join(options.targetDir, result.fileName), result.fileContent);
            }

            res.statusCode = result.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result.body));
          })();
        });
      });
    },
  };
}

function devStaticBoardSavePlugin(): Plugin {
  return devFileSavePlugin({
    name: 'hexoflat-dev-static-board-save',
    endpoint: STATIC_BOARD_SAVE_ENDPOINT,
    handlerModule: '/src/services/dev/static-board-save-handler.ts',
    handlerExport: 'handleStaticBoardSaveRequest',
    targetDir: path.join(boardsContentDir, 'static'),
  });
}

function devBoardModelSavePlugin(): Plugin {
  return devFileSavePlugin({
    name: 'hexoflat-dev-board-model-save',
    endpoint: BOARD_MODEL_SAVE_ENDPOINT,
    handlerModule: '/src/services/dev/board-model-save-handler.ts',
    handlerExport: 'handleBoardModelSaveRequest',
    targetDir: path.join(boardsContentDir, 'models'),
  });
}

export default defineConfig({
  // GitHub Pages serves this repo at https://<user>.github.io/hexoflat/,
  // so assets need that prefix in production. Local dev/build stays at '/'.
  base: process.env.GITHUB_PAGES ? '/hexoflat/' : '/',
  plugins: [vue(), devStaticBoardSavePlugin(), devBoardModelSavePlugin()],
  server: {
    open: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@core': path.resolve(__dirname, 'src/core'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@stores': path.resolve(__dirname, 'src/stores'),
    },
  },
  test: {
    // happy-dom, not 'node': store tests need real localStorage/window
    // timers (Pinia stores here call window.setInterval/setTimeout and
    // localStorage directly, not through an injectable port yet).
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.ts'],
    // Content tests moved to packages/engine (Phase 3); apps/web is only
    // gaining unit tests now, so allow an empty run instead of failing CI
    // for any package/dir that still has none.
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.{test,spec}.ts', 'src/main.ts', 'src/env.d.ts'],
    },
  },
});
