import { lazy, type ComponentType } from 'react';
import { registerRemotes, loadRemote, getInstance } from '@module-federation/runtime';

// Shape of `public/mfe-config.json`, fetched at runtime by src/main.tsx.
// `providers` maps a federation alias to the URL of that provider's
// `remoteEntry.js` (what every supported bundler emits at dev + build time).
export interface MfeConfig {
  providers: Record<string, string>;
}

let initialized = false;

// Bumped on every retry so each attempt uses a fresh module URL (see
// refreshProvider). The browser's ES module map caches a *rejected* dynamic
// import by URL forever, so re-importing the same remoteEntry after a failure
// never even hits the network.
let retryAttempt = 0;

// Registered descriptors keyed by alias, kept so a provider can be re-registered
// with `force` after a failed load (see refreshProvider).
const registeredProviders: Record<string, { alias: string; name: string; entry: string; type?: 'module' }> =
  {};

/** Whether `initFederation` has registered the providers yet. */
export function isFederationInitialized(): boolean {
  return initialized;
}

/**
 * Makes the next `loadRemote` for a provider actually retry.
 *
 * Two separate caches have to be defeated, both verified empirically:
 *
 * 1. The federation runtime's `moduleCache` keeps the Module of the failed
 *    attempt; later `loadRemote` calls reject with the stored error. The
 *    runtime's own `removeRemote` (triggered by `force: true`) only drops a
 *    cache entry when one exists, so the entry is deleted explicitly too.
 * 2. For ESM providers the *browser* memoizes a rejected `import()` by URL
 *    forever - a retry with the same URL performs no network request at all.
 *    Appending a unique query makes the URL new, so the import really happens.
 */
export function refreshProvider(alias: string) {
  const provider = registeredProviders[alias];
  if (!provider) return;

  retryAttempt += 1;
  const retried = {
    ...provider,
    // Unique per attempt AND per page load: a counter alone restarts at 1 after
    // a reload, which would reuse a URL whose import the browser already
    // rejected and defeat the whole point.
    entry: withCacheBuster(provider.entry, `${retryAttempt}-${Date.now()}`),
  };
  registeredProviders[alias] = retried;

  getInstance()?.moduleCache.delete(provider.name);
  registerRemotes([retried], { force: true });
}

/** Adds (or replaces) a `fmretry` query parameter so the module URL is unique. */
function withCacheBuster(entry: string, token: string | number): string {
  const [withoutHash, hash] = entry.split('#');
  const [url, query] = withoutHash.split('?');
  const separator = query ? '&' : '?';
  return `${url}${query ? `?${query}` : ''}${separator}fmretry=${token}${hash ? `#${hash}` : ''}`;
}

/**
 * Registers every provider from the runtime config. Must run before the first
 * remote is requested - i.e. before React renders anything that uses
 * `lazyProvider`. Idempotent, so a hot reload or a second call is harmless.
 */
export function initFederation(config: MfeConfig) {
  if (initialized) return;
  const remotes = Object.entries(config.providers).map(([alias, entry]) => ({
    alias,
    // The provider container name cannot contain `-`; it is the federation
    // `name` from the provider's own config (mfe-credits -> mfe_credits,
    // mfe-calculator -> mfe_calculator).
    name: alias.replace(/-/g, '_'),
    entry,
    // Providers differ in module format: the rspack-built ones emit UMD
    // (`remoteEntry.js`) and must NOT be declared as `module`, or the runtime
    // fails with #RUNTIME-002. The Angular remote built by
    // @nx/module-federation emits ESM (`remoteEntry.mjs`, library.type
    // 'module') and must be declared as such. Derive it from the entry name so
    // the runtime config stays the only place listing providers.
    ...(entry.endsWith('.mjs') ? { type: 'module' as const } : {}),
  }));
  remotes.forEach((remote) => {
    registeredProviders[remote.alias] = remote;
  });
  registerRemotes(remotes);
  initialized = true;
}

/**
 * `React.lazy` wrapper around a remote expose. The returned component must be
 * rendered inside a Suspense/error boundary (see ProviderBoundary in app.tsx).
 *
 * Note on HMR: changing a provider's source while it is mounted in the shell
 * does NOT update the screen. The provider's container does receive the new
 * module (a fresh `loadRemote` returns it), but a `React.lazy` that is already
 * mounted keeps the module it resolved, and rebuilding the lazy instance did
 * not pick the new one up in practice. Reload the page after editing a remote.
 * An earlier attempt to automate this by watching the provider's HMR socket and
 * recreating the lazy instance caused an endless mount/unmount loop ("Loading
 * <provider>..." flicker), so it was removed.
 */
export function lazyProvider<Props = unknown>(alias: string, exposeName: string) {
  return lazy(async () => {
    if (!initialized) {
      // Otherwise this surfaces as an opaque "module not found" from inside the
      // federation runtime, which is much harder to trace back here.
      throw new Error(
        `Federation runtime is not initialized - call initFederation() before loading ${alias}/${exposeName}`
      );
    }
    const mod = await loadRemote<{ default: ComponentType<Props> }>(
      `${alias}/${exposeName}`
    );
    if (!mod) throw new Error(`Failed to load remote ${alias}/${exposeName}`);
    return { default: mod.default };
  });
}
