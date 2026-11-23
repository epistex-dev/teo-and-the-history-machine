const FLAG = 'chunkReloaded';
const PARAM = '_r';
let ramFlag = false;
let reloadPending = false;
let leaving = false;
let speculative = 0;
let onFailure = (): void => undefined;

/** A load nobody waits for (the next chapter, fetched ahead): while it runs its failure event is not a reason to reload the page. Whatever really needs a chunk loads it through `chunkOrFail`, which reports a chunk the swallowed event left undefined. */
export async function quietly<T>(work: () => Promise<T> | null): Promise<T | undefined> {
  speculative += 1;
  try {
    return (await work()) ?? undefined;
  } catch {
    return undefined;
  } finally {
    speculative -= 1;
  }
}

/** A chunk that comes back undefined lost its `vite:preloadError` to a speculative load: it is a failed chunk all the same, so the reload-once or message path runs here. The returned promise then never settles, because the page reloads or shows the message. */
export async function chunkOrFail<T>(load: Promise<T | undefined>): Promise<T> {
  const value = await load;
  if (value !== undefined) return value;
  if (!leaving) handleChunkFailure(onFailure);
  return new Promise<T>(() => undefined);
}

function hasReloaded(): boolean {
  if (ramFlag) return true;
  const state = history.state as Record<string, unknown> | null;
  if (state && state[FLAG] === 1) return true;
  return new URL(location.href).searchParams.has(PARAM);
}

function markReloaded(): void {
  ramFlag = true;
  try {
    const url = new URL(location.href);
    url.searchParams.set(PARAM, '1');
    history.replaceState({ ...(history.state as object | null), [FLAG]: 1 }, '', url);
  } catch {
    /* the RAM flag still covers this page */
  }
}

/** The page was reloaded by a chunk failure: the player is mid-game, so the start screen stays away. */
export const reloadedAfterFailure = (): boolean => new URL(location.href).searchParams.has(PARAM);

export function clearReloadParam(): void {
  try {
    const url = new URL(location.href);
    if (!url.searchParams.has(PARAM)) return;
    url.searchParams.delete(PARAM);
    history.replaceState(history.state, '', url);
  } catch {
    /* ignored */
  }
}

export function handleChunkFailure(onSecondFailure: () => void): void {
  if (reloadPending) return;
  if (!navigator.onLine || hasReloaded()) {
    onSecondFailure();
    return;
  }
  reloadPending = true;
  markReloaded();
  location.reload();
}

export function installPreloadErrorHandler(onSecondFailure: () => void): void {
  onFailure = onSecondFailure;
  window.addEventListener('beforeunload', () => {
    leaving = true;
    setTimeout(() => (leaving = false), 3000);
  });
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) leaving = true;
  });
  window.addEventListener('pageshow', () => (leaving = false));
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    if (leaving || speculative > 0) return;
    handleChunkFailure(onSecondFailure);
  });
  document.addEventListener(
    'error',
    (event) => {
      const link = event.target;
      if (link instanceof HTMLLinkElement && link.rel === 'modulepreload' && !leaving && speculative === 0) handleChunkFailure(onSecondFailure);
    },
    true,
  );
}
