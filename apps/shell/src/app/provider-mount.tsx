import { useEffect, useRef, useState } from 'react';
import { loadRemote } from '@module-federation/runtime';
import { isFederationInitialized, refreshProvider } from '../mf';

/** Module shape every mount-based remote exposes (see mfe-calculator/src/mount.ts). */
type MountModule = { mount?: (element: Element) => Promise<() => void> };

/**
 * Host side of the `mount(element)` contract: mounts a framework-agnostic
 * remote into an element this component owns and tears it down on unmount.
 *
 * Used for remotes that expose a mount function instead of a React component -
 * an Angular remote cannot be rendered as a React element, so the host hands
 * over a DOM node and lets the remote own its own runtime from there. Nothing
 * Angular-specific leaks into the shell.
 *
 * A failed load leaves the remote's dev server unasked-for but the failure
 * sticky, which is exactly what a developer hits after starting the host before
 * the remote. `attempt` is part of the effect dependencies, so the retry button
 * re-runs the whole load instead of forcing a page reload.
 */
export function ProviderMount({ alias, exposeName = 'mount' }: { alias: string; exposeName?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const element = hostRef.current;
    if (!element) return;

    let unmount: (() => void) | undefined;
    let cancelled = false;

    setError(null);

    (async () => {
      try {
        if (!isFederationInitialized()) {
          throw new Error(
            `Federation runtime is not initialized - call initFederation() before loading ${alias}/${exposeName}`
          );
        }
        // A previous failed attempt is cached by the runtime, so a retry has to
        // drop that cache first - otherwise loadRemote keeps rejecting with the
        // stale error even after the remote is reachable again.
        if (attempt > 0) refreshProvider(alias);
        const mod = await loadRemote<MountModule>(`${alias}/${exposeName}`);
        const mount = mod?.mount;
        if (!mount) throw new Error(`Remote ${alias}/${exposeName} does not export mount()`);
        // Re-check after the await: the component may have unmounted while the
        // remote was loading, in which case mounting now would leak a runtime.
        if (cancelled) return;
        unmount = await mount(element);
        if (cancelled) {
          unmount();
          unmount = undefined;
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      }
    })();

    return () => {
      cancelled = true;
      unmount?.();
    };
  }, [alias, exposeName, attempt]);

  // The host element stays mounted in both branches: the effect needs it (and
  // needs the same node) when the retry runs.
  return (
    <>
      {error && (
        <div role="alert" data-testid={`mount-error-${alias}`}>
          <p>
            Provider &quot;{alias}&quot; unavailable: {error.message}
          </p>
          <button type="button" onClick={() => setAttempt((current) => current + 1)}>
            Повторить
          </button>
        </div>
      )}
      <div ref={hostRef} data-testid={`mount-${alias}`} hidden={error !== null} />
    </>
  );
}
