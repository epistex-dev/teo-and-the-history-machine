import { expect, test } from '@playwright/test';
import { createSafeStorage } from '../src/storage.ts';

function backend(overrides: Partial<Record<'getItem' | 'setItem' | 'removeItem', (...args: string[]) => unknown>> = {}, data = new Map<string, string>()): Storage {
  const base = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
  return { ...base, ...overrides } as unknown as Storage;
}

const quota = () => {
  throw new DOMException('full', 'QuotaExceededError');
};
const dead = () => {
  throw new DOMException('denied', 'SecurityError');
};

test.describe('safe storage fallback after a healthy probe', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'pure logic, runs once');
  });

  test('setItem failing later: RAM keeps the value, one warning, write reported as not persisted', () => {
    let failing = false;
    const data = new Map<string, string>();
    const store = createSafeStorage(() => backend({ setItem: (k, v) => (failing ? quota() : data.set(k as string, v as string)) }, data));
    let warnings = 0;
    store.onFallback(() => (warnings += 1));
    expect(store.persistent).toBe(true);
    expect(warnings).toBe(0);
    failing = true;
    expect(store.setItem('a', '1')).toBe(false);
    expect(store.setItem('b', '2')).toBe(false);
    expect(store.persistent).toBe(false);
    expect(warnings).toBe(1);
    expect(store.getItem('a')).toBe('1');
    expect(store.getItem('b')).toBe('2');
  });

  test('a write that works again after a quota error goes back to the backend, with what RAM kept and without what was removed meanwhile', () => {
    let failing = false;
    const data = new Map<string, string>();
    const store = createSafeStorage(() =>
      backend(
        { setItem: (k, v) => (failing ? quota() : data.set(k as string, v as string)), removeItem: (k) => (failing ? quota() : data.delete(k as string)) },
        data,
      ),
    );
    expect(store.setItem('old', '0')).toBe(true);
    failing = true;
    expect(store.setItem('a', '1')).toBe(false);
    store.removeItem('old');
    expect(store.persistent).toBe(false);
    failing = false;
    expect(store.setItem('b', '2')).toBe(true);
    expect(store.persistent).toBe(true);
    expect([...data]).toEqual([['a', '1'], ['b', '2']]);
    expect(store.getItem('a')).toBe('1');
    expect(store.getItem('old')).toBeNull();
  });

  test('a backend that keeps failing is tried on every write and stays in RAM', () => {
    let tries = 0;
    let failing = false;
    const store = createSafeStorage(() => backend({ setItem: () => (failing ? ((tries += 1), quota()) : undefined), getItem: (k) => (k === '__teo_probe__' ? '1' : null) }));
    failing = true;
    expect(store.setItem('a', '1')).toBe(false);
    expect(store.setItem('b', '2')).toBe(false);
    expect(tries).toBe(2);
    expect(store.persistent).toBe(false);
    expect(store.getItem('b')).toBe('2');
  });

  test('getItem failing later: falls back to RAM, one warning, no throw', () => {
    let failing = false;
    const data = new Map<string, string>();
    const store = createSafeStorage(() => backend({ getItem: (k) => (failing ? dead() : (data.get(k as string) ?? null)) }, data));
    let warnings = 0;
    store.onFallback(() => (warnings += 1));
    expect(store.setItem('a', '1')).toBe(true);
    failing = true;
    expect(store.getItem('a')).toBe('1');
    expect(store.getItem('missing')).toBeNull();
    expect(store.persistent).toBe(false);
    expect(warnings).toBe(1);
  });

  test('removeItem failing later degrades without throwing', () => {
    let failing = false;
    const store = createSafeStorage(() => backend({ removeItem: () => (failing ? dead() : undefined) }));
    let warnings = 0;
    store.onFallback(() => (warnings += 1));
    store.setItem('a', '1');
    failing = true;
    store.removeItem('a');
    expect(store.persistent).toBe(false);
    expect(warnings).toBe(1);
    expect(store.getItem('a')).toBeNull();
  });

  test('a backend that accepts and silently drops writes fails the probe', () => {
    const store = createSafeStorage(() => backend({ setItem: () => undefined }));
    let warnings = 0;
    store.onFallback(() => (warnings += 1));
    expect(store.persistent).toBe(false);
    expect(warnings).toBe(1);
    expect(store.setItem('a', '1')).toBe(false);
    expect(store.getItem('a')).toBe('1');
  });

  test('a listener registered after the failure is told at once', () => {
    const store = createSafeStorage(() => backend({ setItem: quota }));
    let warnings = 0;
    store.onFallback(() => (warnings += 1));
    expect(warnings).toBe(1);
  });
});

test.describe('safe storage recovery with other tabs', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'pure logic, runs once');
  });

  /** A localStorage double that lists its keys and whose writes and removals fail while `failing` is true. */
  function shared(data: Map<string, string>, state: { failing: boolean }): Storage {
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => (state.failing ? quota() : void data.set(k, v)),
      removeItem: (k: string) => (state.failing ? quota() : void data.delete(k)),
      key: (i: number) => [...data.keys()][i] ?? null,
      get length() {
        return data.size;
      },
    } as unknown as Storage;
  }

  test('a write that works again never overwrites a value another tab wrote meanwhile, and the store takes that value over', () => {
    const data = new Map([['save', 'v0'], ['other', 'o0']]);
    const state = { failing: false };
    const store = createSafeStorage(() => shared(data, state));
    expect(store.getItem('save')).toBe('v0');
    state.failing = true;
    expect(store.setItem('save', 'mine')).toBe(false);
    expect(store.setItem('other', 'o-mine')).toBe(false);
    data.set('save', 'newer-from-tab-b');
    state.failing = false;
    expect(store.setItem('later', 'l')).toBe(true);
    expect(store.persistent).toBe(true);
    expect(data.get('save'), 'the other tab\'s value stays').toBe('newer-from-tab-b');
    expect(store.getItem('save')).toBe('newer-from-tab-b');
    expect(data.get('other'), 'a key nobody else touched is written back').toBe('o-mine');
    expect(data.get('later')).toBe('l');
  });

  test('a key removed while degraded is removed when writes work again, unless another tab rewrote it', () => {
    const data = new Map([['a', '1'], ['b', '2'], ['c', '3']]);
    const state = { failing: false };
    const store = createSafeStorage(() => shared(data, state));
    state.failing = true;
    store.setItem('c', 'x');
    store.removeItem('a');
    store.removeItem('b');
    expect(store.getItem('a')).toBeNull();
    data.set('b', 'rewritten-by-tab-b');
    state.failing = false;
    expect(store.setItem('d', '4')).toBe(true);
    expect(data.has('a'), 'the removal went through').toBe(false);
    expect(data.get('b'), 'the other tab\'s rewrite survives the removal').toBe('rewritten-by-tab-b');
    expect(store.getItem('b')).toBe('rewritten-by-tab-b');
  });

  test('keys() while degraded lists the keys the old backend still holds, minus the ones this session removed, plus the ones it set', () => {
    const data = new Map([['p:old1', '1'], ['p:old2', '2'], ['q:x', '3']]);
    const state = { failing: false };
    const store = createSafeStorage(() => shared(data, state));
    state.failing = true;
    store.setItem('p:new', 'n');
    store.removeItem('p:old2');
    expect(store.persistent).toBe(false);
    expect(store.keys('p:').sort()).toEqual(['p:new', 'p:old1']);
    expect(store.getItem('p:old1'), 'a key nobody changed is still read from the old backend').toBe('1');
  });

  test('onRecover tells once when the backend takes writes again', () => {
    const data = new Map<string, string>();
    const state = { failing: false };
    const store = createSafeStorage(() => shared(data, state));
    let back = 0;
    store.onRecover(() => (back += 1));
    state.failing = true;
    store.setItem('a', '1');
    expect(back).toBe(0);
    store.setItem('b', '2');
    expect(back).toBe(0);
    state.failing = false;
    store.setItem('c', '3');
    store.setItem('d', '4');
    expect(back).toBe(1);
  });
});
