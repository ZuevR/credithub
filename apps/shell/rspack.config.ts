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

const PORT = 8100;
const NAME = 'shell';

// Shared singletons, per PROJECT.md ("Shared-зависимости MF"). `singleton`
// keeps one copy of React and of the MUI/Emotion styling runtime across the
// shell and every provider; `strictVersion: false` avoids hard failures on
// minor version drift. Note: libs/ui + libs/design-tokens are deliberately
// NOT shared - they are bundled into each application.
const SHARED_PACKAGES = [
  'react',
  'react-dom',
  'react-router-dom',
  '@mui/material',
  '@emotion/react',
  '@emotion/styled',
  '@tanstack/react-query',
] as const;

// Resolve each package's version from its own manifest. `requiredVersion` has
// to be a concrete semver range: the federation runtime compares it as a
// string against the provided version (`satisfy(version, requiredVersion)`),
// so the literal 'auto' never matches and logs
// "shared singleton module X does not satisfy the requirement of ... needs auto"
// for every shared package on the host side.
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

// libs/auth-context объявляется общим singleton'ом: контекст React работает,
// только если это ОДИН объект. Если каждое приложение унесёт свою копию,
// remote получит другой контекст и токена не увидит. Версии у
// workspace-библиотеки нет (нет package.json), поэтому requiredVersion: false -
// иначе федерация сравнивала бы версию с пустотой.
const SHARED_WORKSPACE = {
  '@credithub/auth-context': { singleton: true, requiredVersion: false },
};

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
      port: PORT,
      historyApiFallback: true,
      hot: true,
      // Served explicitly instead of relying on the dev-server default, so
      // `/mfe-config.json` resolves the same way in dev and in the build
      // (where CopyRspackPlugin below writes the same file to dist/).
      static: { directory: path.resolve(__dirname, 'public') },
      // В dev запросы к API идут на BFF через прокси дев-сервера: фронт всегда
      // обращается по относительному `/api/*`, как в проде через ingress, и
      // приложению не нужен адрес бэкенда в конфиге.
      proxy: [
        {
          context: ['/api'],
          target: process.env.BFF_ORIGIN ?? 'http://localhost:3000',
          changeOrigin: true,
        },
      ],
    },
    resolve: {
      extensions: ['...', '.ts', '.tsx', '.jsx'],
      // Workspace libraries are consumed as TypeScript source (they have no
      // build step and no package.json), so they must be aliased explicitly
      // to their entry files. Mirrors the `paths` in tsconfig.base.json; the
      // order matters, most specific first.
      alias: {
        '@credithub/auth-context': path.resolve(
          __dirname,
          '../../libs/auth-context/src/index.ts'
        ),
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
      new rspack.HtmlRspackPlugin({ template: './index.html' }),
      // `mfe-config.json` is the runtime provider registry fetched by
      // src/main.tsx. Without this copy it would exist only in `public/`
      // (dev-server) and be missing from a production build.
      new rspack.CopyRspackPlugin({
        patterns: [{ from: 'public/mfe-config.json' }],
      }),
      new ModuleFederationPlugin({
        name: NAME,
        // No build-time `remotes:` block - registered at runtime in
        // src/mf.tsx at module load time.
        shared: { ...SHARED, ...SHARED_WORKSPACE },
      }),
    ].filter(Boolean),
  };
});
