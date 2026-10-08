
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
export default defineConfig(() => ({
    root: import.meta.dirname,
    cacheDir: '../../node_modules/.vite/libs/ui',
    plugins: [react(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md']),],
    // Uncomment this if you are using workers.
    // worker: {
    //   plugins: () => [ nxViteTsPaths() ],
    // },
    test: {
        'name': 'ui',
        'watch': false,
        'globals': true,
        'environment': "jsdom",
        // The library has no spec files at the moment (the generator's
        // ui.spec.tsx was removed while splitting it into components). Without
        // this, `vitest` exits non-zero on "No test files found" and the whole
        // `test:all` run is red even though nothing is broken.
        'passWithNoTests': true,
        'include': ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
        'reporters': ["default"],
        'coverage': {
            'reportsDirectory': '../../coverage/libs/ui',
            'provider': 'v8' as const,
        }
    },
}));