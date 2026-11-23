import './title.css';
import { chunkOrFail } from './preload-error.ts';
import type { Flow } from './flow.ts';

export interface TitleDeps {
  flow: Flow;
  ensureShell: () => Promise<void>;
}

const ART = import.meta.glob<string>('../art/baked/title.webp', { query: '?url', import: 'default' });

const markup = (hasSave: boolean): string => `
<div class="title-page">
  <figure class="title-vignette">
    <img alt="Bản khắc Tèo và Cúc Cu gặp Cỗ máy Lịch sử dưới ánh đèn" />
  </figure>
  <div class="title-body">
    <h2 class="title-name" id="title-heading"><em>Tèo và</em><span class="caps">Cỗ máy Lịch sử</span></h2>
    <nav class="title-list" aria-label="Menu chính">
      <button type="button" class="title-start">Bắt đầu</button>
      <button type="button" class="title-continue"${hasSave ? '' : ' hidden'}>Tiếp tục</button>
      <button type="button" class="title-code">Nhập mã</button>
      <button type="button" class="title-notebook">Sổ nguồn</button>
      <button type="button" class="title-settings">Cài đặt</button>
    </nav>
  </div>
</div>`;

/** The start screen: an engraved title page over the booted game. Nhập mã, Sổ nguồn and Cài đặt press the Menu's own buttons through the lazily wired shell; Bắt đầu plays on from the fresh start the boot already holds, and asks the Menu's new-game confirm when there is progress to lose. */
export async function showTitle({ flow, ensureShell }: TitleDeps): Promise<void> {
  const hasSave = flow.hasProgress;
  const dlg = document.createElement('dialog');
  dlg.id = 'title';
  dlg.setAttribute('aria-labelledby', 'title-heading');
  dlg.innerHTML = markup(hasSave);
  dlg.addEventListener('cancel', (event) => event.preventDefault());
  document.body.append(dlg);

  const close = (): void => {
    flow.onRestart = null;
    dlg.close();
    dlg.remove();
    document.querySelector<HTMLElement>('main section:not([hidden]) > h2[tabindex="-1"]')?.focus({ preventScroll: true });
  };
  flow.onRestart = close;

  const button = (name: string) => dlg.querySelector<HTMLButtonElement>('.title-' + name) as HTMLButtonElement;
  const viaShell = (id: string): void => void ensureShell().then(() => (document.getElementById(id) as HTMLButtonElement).click());
  button('start').addEventListener('click', () => {
    if (!hasSave) return close();
    void ensureShell().then(() => {
      const confirm = document.getElementById('confirm-new') as HTMLDialogElement;
      if (!confirm.open) confirm.showModal();
    });
  });
  button('continue').addEventListener('click', close);
  button('code').addEventListener('click', () => viaShell('menu-code'));
  button('notebook').addEventListener('click', () => viaShell('menu-notebook'));
  button('settings').addEventListener('click', () => viaShell('menu-settings'));

  dlg.showModal();
  button(hasSave ? 'continue' : 'start').focus();

  const img = dlg.querySelector('img') as HTMLImageElement;
  const load = ART['../art/baked/title.webp'];
  if (!load) throw new Error('Thiếu ảnh khắc tiêu đề');
  img.src = await chunkOrFail(load());
  await img.decode().catch(() => undefined);
  img.dataset.ready = 'true';
}
