import type { ModuleFederationConfig } from '@nx/module-federation';

const config: ModuleFederationConfig = {
  name: 'mfe-calculator',
  exposes: {
    // The host-facing contract: `mount(element): Promise<() => void>`.
    // The shell does not mount an Angular component itself - it hands over a
    // DOM element and gets a teardown function back (see src/mount.ts).
    './mount': 'apps/mfe-calculator/src/mount.ts',
  },
};

/**
* Nx requires a default export of the config to allow correct resolution of the module federation graph.
**/
export default config;
