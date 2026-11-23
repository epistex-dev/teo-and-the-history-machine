type Attrs = Record<string, string | number | boolean | null | undefined>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Node | string | null)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = String(value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) if (child !== null) el.append(child);
  return el;
}

/** Keeps keyboard focus on the same control after a part of the board is rebuilt. */
export function keepFocus(root: HTMLElement, rebuild: () => void, next?: string): void {
  const key = next ?? (document.activeElement instanceof HTMLElement && root.contains(document.activeElement) ? document.activeElement.dataset.fk : undefined);
  const held: [Element, number][] = [];
  for (let el = root.parentElement; el; el = el.parentElement) if (el.scrollTop > 0) held.push([el, el.scrollTop]);
  rebuild();
  for (const [el, top] of held) el.scrollTop = top;
  if (!key) return;
  const target = [...root.querySelectorAll<HTMLElement>('[data-fk]')].find((el) => el.dataset.fk === key);
  target?.focus({ preventScroll: true });
}

export const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};
