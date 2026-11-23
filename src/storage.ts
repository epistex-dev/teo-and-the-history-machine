type Listener = () => void;

export interface SafeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): boolean;
  removeItem(key: string): void;
  /** Keys that start with the prefix: the backend's while it works; after it degraded, what this session kept plus what the old backend still lists. */
  keys(prefix: string): string[];
  readonly persistent: boolean;
  onFallback(listener: Listener): void;
  /** The backend took the writes again. */
  onRecover(listener: Listener): void;
}

export function createSafeStorage(getBackend?: () => Storage): SafeStorage {
  const ram = new Map<string, string>();
  const listeners: Listener[] = [];
  let backend: Storage | null = null;
  let persistent = true;
  let lost: Storage | null = null;
  const recovered: Listener[] = [];

  try {
    backend = getBackend ? getBackend() : window.localStorage;
  } catch {
    persistent = false;
  }
  if (!backend) persistent = false;

  const degrade = () => {
    if (!persistent && backend === null) return;
    persistent = false;
    lost = backend;
    backend = null;
    for (const listener of listeners) listener();
  };

  if (backend) {
    try {
      const probe = '__teo_probe__';
      backend.setItem(probe, '1');
      const readBack = backend.getItem(probe);
      backend.removeItem(probe);
      if (readBack !== '1') degrade();
    } catch {
      degrade();
    }
    if (!persistent) lost = null;
  }

  /** Keys this session set or removed while degraded (null = removed), with what the backend held when the session first touched each. */
  const changed = new Map<string, string | null>();
  const base = new Map<string, string | null>();

  const change = (key: string, value: string | null): void => {
    if (!lost) return;
    if (!changed.has(key)) {
      try {
        base.set(key, lost.getItem(key));
      } catch {
        base.set(key, null);
      }
    }
    changed.set(key, value);
  };

  /**
   * A failed write may be a full quota that clears again: try the backend once more. What this session changed goes back only where the backend still holds what it held
   * when the session first touched the key; anything another tab wrote since wins and is taken over. The backend is trusted again once every change is dealt with.
   */
  const recover = (): boolean => {
    if (!lost) return false;
    try {
      for (const [key, value] of [...changed]) {
        const now = lost.getItem(key);
        if (now === (base.get(key) ?? null)) {
          if (value === null) lost.removeItem(key);
          else {
            lost.setItem(key, value);
            if (lost.getItem(key) !== value) return false;
          }
        } else if (now === null) ram.delete(key);
        else ram.set(key, now);
        changed.delete(key);
        base.delete(key);
      }
    } catch {
      return false;
    }
    backend = lost;
    lost = null;
    persistent = true;
    for (const listener of recovered) listener();
    return true;
  };

  return {
    get persistent() {
      return persistent;
    },
    onFallback(listener) {
      listeners.push(listener);
      if (!persistent) listener();
    },
    onRecover(listener) {
      recovered.push(listener);
    },
    getItem(key) {
      if (backend) {
        try {
          return backend.getItem(key);
        } catch {
          degrade();
        }
      }
      if (!changed.has(key) && lost) {
        try {
          return lost.getItem(key);
        } catch {
          /* the old backend cannot be read: RAM is all there is */
        }
      }
      return ram.get(key) ?? null;
    },
    setItem(key, value) {
      ram.set(key, value);
      if (backend) {
        try {
          backend.setItem(key, value);
          return true;
        } catch {
          degrade();
          change(key, value);
          return false;
        }
      }
      change(key, value);
      return recover();
    },
    keys(prefix) {
      if (backend) {
        try {
          const found: string[] = [];
          for (let i = 0; i < backend.length; i += 1) {
            const key = backend.key(i);
            if (key?.startsWith(prefix)) found.push(key);
          }
          return found;
        } catch {
          degrade();
        }
      }
      const found = new Set([...ram.keys()].filter((key) => key.startsWith(prefix)));
      if (lost) {
        try {
          for (let i = 0; i < lost.length; i += 1) {
            const key = lost.key(i);
            if (key?.startsWith(prefix) && changed.get(key) !== null) found.add(key);
          }
        } catch {
          /* the old backend cannot be listed */
        }
      }
      return [...found];
    },
    removeItem(key) {
      ram.delete(key);
      if (backend) {
        try {
          backend.removeItem(key);
        } catch {
          degrade();
        }
      }
      change(key, null);
    },
  };
}
