import { expect, test } from '@playwright/test';

test.describe('Open Graph tags (R14)', () => {
  test('the built page carries the OG and Twitter tags and the preview image is a 1200 x 630 PNG', async ({ request, baseURL }) => {
    const html = await (await request.get('/')).text();
    const meta = (key: string) => new RegExp(`<meta\\s+(?:property|name)="${key}"\\s+content="([^"]*)"`).exec(html)?.[1];
    expect(meta('og:type')).toBe('website');
    expect(meta('og:title')).toBe('Tèo và Cỗ máy Lịch sử');
    expect(meta('og:description')?.length).toBeGreaterThan(30);
    expect(meta('og:locale')).toBe('vi_VN');
    expect(meta('og:image:width')).toBe('1200');
    expect(meta('og:image:height')).toBe('630');
    expect(meta('og:image:alt')).toContain('Tèo');
    expect(meta('twitter:card')).toBe('summary_large_image');
    const image = new URL(meta('og:image') ?? 'x:');
    expect(image.protocol).toBe('https:');
    expect(image.host, 'the host the OG image is pinned to').toBe('teo-co-may-lich-su.pages.dev');
    expect(image.pathname).toBe('/og.png');
    expect(meta('twitter:image')).toBe(meta('og:image'));
    const png = await request.get(new URL(image.pathname, baseURL).toString());
    expect(png.status()).toBe(200);
    expect(png.headers()['content-type']).toContain('image/png');
    const bytes = await png.body();
    expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(bytes.readUInt32BE(16)).toBe(1200);
    expect(bytes.readUInt32BE(20)).toBe(630);
    expect(bytes.length).toBeLessThan(300_000);
  });
});
