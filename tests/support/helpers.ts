import { expect, type Page } from '@playwright/test';

export interface Monitor {
  /** CSP complaints raised while Playwright's WebKit screenshot injects its own <style>; not from the app. */
  screenshotCspNoise: string[];
  snapping: boolean;
  consoleErrors: string[];
  pageErrors: string[];
  hosts: Set<string>;
  loads: () => number;
}

export function monitor(page: Page): Monitor {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const hosts = new Set<string>();
  let loads = 0;
  const m: Monitor = { screenshotCspNoise: [], snapping: false, consoleErrors, pageErrors, hosts, loads: () => loads };
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (m.snapping && /Refused to apply a stylesheet.*Content Security Policy/.test(text)) m.screenshotCspNoise.push(text);
    else consoleErrors.push(text);
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol === 'http:' || url.protocol === 'https:') hosts.add(url.host);
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) loads += 1;
  });
  return m;
}

export async function screenshot(page: Page, m?: Monitor): Promise<Buffer> {
  if (m) m.snapping = true;
  try {
    const png = await page.screenshot({ scale: 'css', caret: 'initial' });
    await page.waitForTimeout(150);
    return png;
  } finally {
    if (m) m.snapping = false;
  }
}

export function expectClean(m: Monitor, baseURL: string): void {
  expect(m.consoleErrors, 'console errors').toEqual([]);
  expect(m.pageErrors, 'uncaught page errors').toEqual([]);
  expect([...m.hosts], 'hosts contacted').toEqual([new URL(baseURL).host]);
}
