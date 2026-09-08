import {
  createElement,
  lazy,
  useState,
  type ComponentProps,
  type ComponentType,
} from "react";

type Loader<T extends ComponentType<any>> = () => Promise<{ default: T }>;

export type PreloadableComponent<T extends ComponentType<any>> =
  ComponentType<ComponentProps<T>> & { preload: () => Promise<{ default: T }> };

/**
 * React.lazy plus a `preload()` you can call before the route renders, so the
 * chunk is already in memory by the time the agent clicks the nav item.
 *
 * Two things beyond plain lazy():
 *
 * 1. The loader is memoised here rather than left to React.lazy's own caching.
 *    lazy() only invokes its factory when the component first renders, which is
 *    exactly the moment we are trying to make free; `preload()` primes the same
 *    promise lazy() would later await.
 *
 * 2. A warmed route renders the real component directly instead of going back
 *    through Suspense. Even an already-settled lazy() unwinds the render once
 *    before resuming, and that unwind is the flash of page skeleton this whole
 *    mechanism exists to remove.
 */
export function lazyWithPreload<T extends ComponentType<any>>(
  loader: Loader<T>,
): PreloadableComponent<T> {
  let pending: Promise<{ default: T }> | null = null;
  let loaded: T | null = null;

  const load = () => {
    if (!pending) {
      pending = loader()
        .then((mod) => {
          loaded = mod.default;
          return mod;
        })
        .catch((err) => {
          // A warm-up that fails (offline, a stale chunk after a deploy) must
          // not poison the real navigation. Drop the cached rejection so the
          // next caller — usually React.lazy at render time — retries.
          pending = null;
          throw err;
        });
    }
    return pending;
  };

  const Lazy = lazy(load);

  const Route = ((props: ComponentProps<T>) => {
    // Decided once per mount and then frozen. Reading `loaded` on every render
    // would swap the element type from Lazy to the real component the moment
    // the chunk arrives, and React remounts on a changed type — the page would
    // throw away its state and refetch mid-view.
    const [Warm] = useState(() => loaded);
    return createElement(Warm ?? Lazy, props);
  }) as PreloadableComponent<T>;

  Route.preload = load;
  return Route;
}
