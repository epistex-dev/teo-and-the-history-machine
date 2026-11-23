import { copyText, showCode } from './clipboard.ts';
import { chunkOrFail } from './preload-error.ts';
import { makeCode, parseCode } from './code.ts';
import { indexOf, ORDER } from './order.ts';
import { isFrame } from './meta.ts';
import type { Flow } from './flow.ts';
import { applyToDocument, type Settings, type SettingsStore } from './settings.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const GEARS_NOTE = 'Sổ nguồn đang gập: các thẻ đã vào lòng máy, thành bánh răng.';

function open(dialog: HTMLDialogElement): void {
  if (!dialog.open) dialog.showModal();
}

export function wireShell(flow: Flow, settings: SettingsStore, onSettings: (s: Settings) => void): void {
  const menu = $<HTMLDialogElement>('menu');
  const confirm = $<HTMLDialogElement>('confirm-new');
  const settingsDialog = $<HTMLDialogElement>('settings');
  const codeDialog = $<HTMLDialogElement>('code-dialog');
  const notebook = $<HTMLDialogElement>('notebook-dialog');
  const logDialog = $<HTMLDialogElement>('log-dialog');
  const closeMenu = () => menu.close();

  const menuNote = $('menu-note');
  $('menu-open').addEventListener('click', () => {
    menuNote.hidden = true;
    open(menu);
  });
  $('menu-continue').addEventListener('click', closeMenu);
  $('menu-new').addEventListener('click', () => {
    closeMenu();
    open(confirm);
  });
  $('confirm-new-no').addEventListener('click', () => confirm.close());
  $('confirm-new-yes').addEventListener('click', () => {
    confirm.close();
    void flow.newGame();
  });
  $('menu-settings').addEventListener('click', () => {
    closeMenu();
    syncSettings();
    open(settingsDialog);
  });
  $('menu-code').addEventListener('click', () => {
    closeMenu();
    showCode($<HTMLTextAreaElement>('code-mine'), makeCode(flow.codeData()));
    $<HTMLInputElement>('code-input').value = '';
    $('code-error').textContent = '';
    $('code-note').textContent = '';
    open(codeDialog);
  });
  const showNotebook = async () => {
    await fillNotebook(flow);
    if (!flow.cardsAreGears) open(notebook);
  };
  $('menu-notebook').addEventListener('click', () => {
    if (flow.cardsAreGears) {
      menuNote.textContent = GEARS_NOTE;
      menuNote.hidden = false;
      return;
    }
    closeMenu();
    void showNotebook();
  });
  $('end-notebook').addEventListener('click', () => void showNotebook());
  $('end-card').addEventListener('click', () => flow.replayNameCard());
  $('end-new').addEventListener('click', () => open(confirm));
  $('log-open').addEventListener('click', () => {
    const list = $('log-list');
    list.replaceChildren(
      ...flow.log.map((line) => {
        const li = document.createElement('li');
        if (line.speaker) {
          const who = document.createElement('b');
          who.textContent = `${line.speaker}: `;
          li.append(who);
        }
        li.append(line.text);
        return li;
      }),
    );
    if (!flow.log.length) list.replaceChildren(Object.assign(document.createElement('li'), { textContent: 'Chưa có thoại nào.' }));
    open(logDialog);
    list.scrollTop = list.scrollHeight;
  });

  $('code-copy').addEventListener('click', () => void copyText($<HTMLTextAreaElement>('code-mine').value, $<HTMLTextAreaElement>('code-mine'), $('code-note')));
  $('code-use').addEventListener('click', () => {
    const result = parseCode($<HTMLInputElement>('code-input').value);
    if (!result.ok) {
      $('code-error').textContent = result.message;
      return;
    }
    codeDialog.close();
    void flow.loadProgress(result.data);
  });
  $<HTMLInputElement>('code-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      $('code-use').click();
    }
  });

  const sync = (id: string, value: string) => ($<HTMLSelectElement>(id).value = value);
  function syncSettings(): void {
    const s = settings.current;
    sync('set-speed', s.textSpeed);
    sync('set-auto', s.autoAdvance);
    sync('set-font', s.fontSize);
    $<HTMLInputElement>('set-music').value = String(s.music);
    $<HTMLInputElement>('set-sfx').value = String(s.sfx);
    $('out-music').textContent = `${s.music}%`;
    $('out-sfx').textContent = `${s.sfx}%`;
    $<HTMLInputElement>('set-motion').checked = settings.reducedMotion;
    $('motion-hint').textContent = s.reducedMotion === null ? 'Đang theo cài đặt của thiết bị.' : 'Đã chọn riêng, không còn theo thiết bị.';
  }
  const bind = (id: string, apply: (value: string) => Partial<Settings>, eventName: 'change' | 'input' = 'change') => {
    $(id).addEventListener(eventName, (event) => {
      settings.update(apply((event.target as HTMLInputElement).value));
      syncSettings();
    });
  };
  bind('set-speed', (v) => ({ textSpeed: v as Settings['textSpeed'] }));
  bind('set-auto', (v) => ({ autoAdvance: v as Settings['autoAdvance'] }));
  bind('set-font', (v) => ({ fontSize: v as Settings['fontSize'] }));
  bind('set-music', (v) => ({ music: Number(v) }), 'input');
  bind('set-sfx', (v) => ({ sfx: Number(v) }), 'input');
  $('set-motion').addEventListener('change', (event) => {
    settings.update({ reducedMotion: (event.target as HTMLInputElement).checked });
    syncSettings();
  });
  settings.onChange((s) => {
    applyToDocument(settings);
    onSettings(s);
  });
  applyToDocument(settings);
  onSettings(settings.current);
}

async function fillNotebook(flow: Flow): Promise<void> {
  const list = $('notebook-list');
  const done = ORDER.filter((id) => !isFrame(id) && (indexOf(id) < indexOf(flow.save.furthest) || id === flow.cardChapter));
  if (!done.length) {
    list.replaceChildren(Object.assign(document.createElement('p'), { textContent: 'Chưa có thẻ nào. Mỗi chương xong sẽ thêm một thẻ.' }));
    return;
  }
  const { loadEntry, renderCard } = await chunkOrFail(import('./notebook.ts'));
  const entries = await Promise.all(done.map((id) => loadEntry(id)));
  list.replaceChildren(...entries.map((entry) => renderCard(entry, 'h3')));
}
