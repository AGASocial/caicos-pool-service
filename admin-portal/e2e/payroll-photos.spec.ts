/**
 * Payroll CSV export + pool photo history (QA company only).
 * Runs after full-flow.spec.ts, which completes a QA route job with a photo today.
 */
import { test, expect, type Page, type Locator } from '@playwright/test';
import fs from 'fs';

const ADMIN_EMAIL = 'qa-admin@cadenzaops.com';
const ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD;
const BASE = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

async function fillSecret(locator: Locator, value: string) {
  await test.step('Enter password', async () => {
    await locator.evaluate((el, v) => {
      const input = el as HTMLInputElement;
      const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value');
      desc?.set?.call(input, v);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  });
}

async function adminLogin(page: Page) {
  await page.goto(`${BASE}/en/auth/login`);
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await fillSecret(page.getByLabel(/password/i), ADMIN_PASSWORD!);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.includes('/auth'), { timeout: 20000 });
}

function chicagoToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}
function daysAgo(n: number): string {
  const d = new Date(Date.now() - n * 86_400_000);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

test.describe('Payroll export & photo history (QA company)', () => {
  test.skip(!ADMIN_PASSWORD, 'QA_ADMIN_PASSWORD not set');

  test('payroll CSV downloads with BOM and rows matching report stats', async ({ page }) => {
    await adminLogin(page);
    const from = daysAgo(30);
    const to = chicagoToday();

    await page.goto(`${BASE}/en/reports`);
    await page.locator('#date-from').fill(from);
    await page.locator('#date-to').fill(to);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('payroll-export-csv').click(),
    ]);
    expect(download.suggestedFilename()).toBe(`payroll_${from}_${to}.csv`);
    const buf = fs.readFileSync((await download.path())!);
    expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf]);
    const lines = buf.toString('utf8').slice(1).split('\r\n');
    expect(lines[0]).toBe('Technician,Date,Customer,Address,Completed Time');

    const json = await (await page.request.get(`${BASE}/api/reports/jobs/payroll?date_from=${from}&date_to=${to}&format=json`)).json();
    const stats = await (await page.request.get(`${BASE}/api/reports/jobs?date_from=${from}&date_to=${to}`)).json();
    const statsCompleted = (stats.byTechnician as { completed: number }[]).reduce((s, t) => s + t.completed, 0);
    expect(json.rows.length).toBe(statsCompleted);
    expect(lines.filter((l) => /^[^,]+,\d{4}-\d{2}-\d{2},/.test(l)).length).toBe(json.rows.length);
    // QA company only: every customer is a QA customer
    for (const r of json.rows as { customer: string }[]) expect(r.customer).toMatch(/^QA /);
    // Rows exist only after full-flow.spec.ts has completed a QA job in this window.
    if (process.env.E2E_EXPECT_PAYROLL_ROWS === '1') expect(json.rows.length).toBeGreaterThan(0);

    const bad = await page.request.get(`${BASE}/api/reports/jobs/payroll?date_from=2026-02-01&date_to=2026-01-01`);
    expect(bad.status()).toBe(400);
  });

  test('pool page shows photo history newest first with signed URLs', async ({ page }) => {
    await adminLogin(page);
    const propsRes = await page.request.get(`${BASE}/api/properties?limit=100&active_only=false`);
    const body = await propsRes.json();
    const list = (Array.isArray(body) ? body : body.data ?? body.items ?? body.properties ?? []) as { id: string; address: string }[];
    const prop = list.find((p) => p.address === '123 Test St') ?? list[0];
    expect(prop, 'QA property 123 Test St').toBeTruthy();

    const api = await (await page.request.get(`${BASE}/api/properties/${prop.id}/photo-history?page=1&page_size=5`)).json();
    const dates = (api.visits as { scheduledDate: string }[]).map((v) => v.scheduledDate);
    expect([...dates].sort().reverse()).toEqual(dates);

    await page.goto(`${BASE}/en/properties/${prop.id}`);
    const history = page.getByTestId('photo-history');
    await expect(history).toBeVisible();
    if (api.visits.length === 0) {
      await expect(page.getByTestId('photo-history-empty')).toBeVisible();
      return;
    }
    await expect(page.getByTestId('photo-history-visit').first()).toHaveAttribute('data-date', dates[0]);
    const hot = (api.visits as { photos: { url: string | null; archived: boolean }[] }[]).flatMap((v) => v.photos).filter((p) => p.url);
    if (hot.length) {
      expect(hot[0].url).toContain('/storage/v1/object/sign/report-photos/');
      await expect(page.getByTestId('photo-history-img').first()).toBeVisible();
    }
    const other = await page.request.get(`${BASE}/api/properties/00000000-0000-0000-0000-000000000000/photo-history`);
    expect(other.status()).toBe(404);
  });
});
