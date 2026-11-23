const COPIED = 'Đã sao chép mã.';
const SELECTED = 'Chưa chép tự động được. Mã đã chọn sẵn: nhấn giữ hoặc bấm Ctrl+C để chép.';

const watched = new WeakSet<HTMLTextAreaElement>();

const rowsOf = (area: HTMLTextAreaElement, style: CSSStyleDeclaration): number =>
  Math.round((area.scrollHeight - parseFloat(style.paddingBlockStart) - parseFloat(style.paddingBlockEnd)) / parseFloat(style.lineHeight));

/** text-wrap: balance does not reach textareas: pad the end of the box as far as the row count allows (less a few px, so a rounding step cannot add a row), so the rows come out even and no short tail is left. */
function evenWrap(area: HTMLTextAreaElement): void {
  area.style.paddingInlineEnd = '';
  if (area.clientWidth === 0) return;
  const style = getComputedStyle(area);
  const rows = rowsOf(area, style);
  if (rows < 2) return;
  const base = parseFloat(style.paddingInlineEnd);
  let fits = 0;
  let breaks = area.clientWidth;
  while (breaks - fits > 1) {
    const mid = (fits + breaks) >> 1;
    area.style.paddingInlineEnd = `${base + mid}px`;
    if (rowsOf(area, style) === rows) fits = mid;
    else breaks = mid;
  }
  area.style.paddingInlineEnd = `${base + Math.max(0, fits - 6)}px`;
}

export function showCode(area: HTMLTextAreaElement, code: string): void {
  area.value = code;
  if (!watched.has(area)) {
    watched.add(area);
    new ResizeObserver(() => evenWrap(area)).observe(area, { box: 'border-box' });
    document.fonts.addEventListener('loadingdone', () => evenWrap(area));
  }
  evenWrap(area);
}

export async function copyText(text: string, field: HTMLInputElement | HTMLTextAreaElement, note: HTMLElement): Promise<boolean> {
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    field.select();
    field.setSelectionRange(0, text.length);
    ok = document.execCommand?.('copy') ?? false;
  }
  note.textContent = ok ? COPIED : SELECTED;
  return ok;
}
