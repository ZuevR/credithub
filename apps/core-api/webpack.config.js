const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/core-api'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      // Seed собирается вместе с приложением: так его пути `@credithub/*`
      // разрешает webpack. При отдельном запуске через ts-node их пришлось бы
      // настраивать вручную - а `tsconfig-paths` требует устаревший `baseUrl`.
      additionalEntryPoints: [
        { entryName: 'seed', entryPath: './src/db/seed-cli.ts' },
      ],
      tsConfig: './tsconfig.app.json',
      assets: ["./src/assets"],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      sourceMap: true,
    })
  ],
};
