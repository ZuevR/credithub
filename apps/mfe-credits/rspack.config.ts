import { defineConfig } from '@rspack/cli';
import { rspack } from '@rspack/core';
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';
import { ReactRefreshRspackPlugin } from '@rspack/plugin-react-refresh';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// __dirname is undefined when @rspack/cli loads this config as ESM (it
// does, because the file uses `import` statements). Derive it from the
// module URL so the config works regardless of how the loader interprets it.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = 8101;
const NAME = 'mfe_credits';

// Same singleton/strictVersion policy as the shell (see PROJECT.md). Only the
// packages this provider actually imports are listed: it must declare a
// package as shared for the host's instance to be used instead of its own
// bundled copy, so this list grows together with the imports in src/. The MUI
// stack is here because src/credits-app.tsx renders PageHeader/WidgetShell from
// libs/ui; @tanstack/react-query is used by the credits query below, and
// react-router-dom is still unused here.
// @emotion/* is shared even though it is only reached transitively (through
// MUI) so that the styling singleton is explicit rather than accidental.
//
// KNOWN DEV-MODE LIMITATION (see PROGRESS.md B4): serving this provider
// standalone through the dev server reports ChunkLoadError for the
// `webpack_sharing_consume_default_emotion_*` fallback chunk. The UI still
// renders; production builds and the shell-hosted setup are unaffected.
const SHARED_PACKAGES = [
  'react',
  'react-dom',
  '@mui/material',
  '@emotion/react',
  '@emotion/styled',
  // Singleton: react-query хранит кэш и дедуплицирует запросы в своём
  // экземпляре. Две копии в одном приложении означали бы два независимых кэша
  // и повторные походы в сеть за одними и теми же данными.
  '@tanstack/react-query',
] as const;

// See the shell config for why this is a concrete range and not 'auto'.
function installedVersion(pkg: string): string {
  const manifest = path.resolve(__dirname, '../../node_modules', pkg, 'package.json');
  return JSON.parse(fs.readFileSync(manifest, 'utf8')).version as string;
}

const SHARED = Object.fromEntries(
  SHARED_PACKAGES.map((pkg) => [
    pkg,
    {
      singleton: true,
      strictVersion: false,
      requiredVersion: `^${installedVersion(pkg)}`,
    },
  ])
);

// Read mode from the rspack CLI arg (`--mode=development|production`) so the
// config works the same on Windows + POSIX without depending on a shell
// `NODE_ENV=...` prefix.
export default defineConfig((_env, argv) => {
  const isDev = argv.mode !== 'production';
  return {
    context: __dirname,
    entry: { main: './src/index.ts' },
    output: {
      path: path.resolve(__dirname, 'dist'),
      publicPath: 'auto',
      uniqueName: NAME,
      clean: true,
    },
    devServer: {
      // Standalone-режим обращается к тому же относительному /api, что и в
      // hosted: без прокси запрос ушёл бы на дев-сервер провайдера и вернул
      // HTML вместо данных.
      proxy: [
        {
          context: ['/api'],
          target: process.env.BFF_ORIGIN ?? 'http://localhost:3000',
          changeOrigin: true,
        },
      ],
      port: PORT,
      historyApiFallback: true,
      hot: true,
      headers: { 'Access-Control-Allow-Origin': '*' },
    },
    resolve: {
      extensions: ['...', '.ts', '.tsx', '.jsx'],
      // Workspace libraries are consumed as TypeScript source (no build step,
      // no package.json), so they must be aliased explicitly - mirrors the
      // `paths` in tsconfig.base.json and the shell's config. libs/ui itself
      // imports @credithub/design-tokens, so both aliases are required.
      alias: {
        '@credithub/design-tokens': path.resolve(
          __dirname,
          '../../libs/design-tokens/src/index.ts'
        ),
        '@credithub/shared-types': path.resolve(
          __dirname,
          '../../libs/shared-types/src/index.ts'
        ),
        '@credithub/ui': path.resolve(__dirname, '../../libs/ui/src/index.ts'),
      },
    },
    module: {
      rules: [
        {
          test: /\.(j|t)sx?$/,
          exclude: [/node_modules/],
          use: {
            loader: 'builtin:swc-loader',
            options: {
              jsc: {
                parser: { syntax: 'typescript', tsx: true },
                transform: {
                  react: { runtime: 'automatic', development: isDev, refresh: isDev },
                },
              },
              env: { targets: 'Chrome >= 87, Firefox >= 78, Edge >= 88, Safari >= 14' },
            },
          },
        },
      ],
    },
    plugins: [
      isDev && new ReactRefreshRspackPlugin(),
      // excludeChunks is REQUIRED on a provider: without it the federation
      // remoteEntry chunk gets injected into the standalone HTML and breaks
      // direct serves.
      new rspack.HtmlRspackPlugin({ template: './index.html', excludeChunks: [NAME] }),
      new ModuleFederationPlugin({
        name: NAME,
        filename: 'remoteEntry.js',
        exposes: {
          './CreditsApp': './src/credits-app.tsx',
        },
        shared: SHARED,
      }),
    ].filter(Boolean),
  };
});
