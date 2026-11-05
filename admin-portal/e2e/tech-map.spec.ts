/**
 * Technician map E2E (admin live dashboard).
 *
 * Real QA admin login (QA_ADMIN_PASSWORD), then the browser-side Supabase calls the map makes are
 * mocked so the test is deterministic and never writes to the shared DB:
 *  - REST cadenza_technician_locations / today's map jobs → fixtures in Davie, FL
 *  - Realtime websocket → a tiny Phoenix stub that acks channel joins and pushes postgres_changes
 * Video is recorded for this spec (used for the PR demo clip).
 */
import { test, expect, type Page, type Locator, type WebSocketRoute } from '@playwright/test';

const ADMIN_EMAIL = 'qa-admin@cadenzaops.com';
const ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD;
const BASE = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

test.use({ video: { mode: 'on', size: { width: 1280, height: 800 } }, viewport: { width: 1280, height: 800 } });
test.skip(!ADMIN_PASSWORD, 'QA_ADMIN_PASSWORD not set');

const now = () => new Date().toISOString();
const COMPANY = 'mock-company';
const TECHS = [
  { id: '00000000-0000-4000-8000-0000000000a1', name: 'Carlos Méndez', lat: 26.0702, lng: -80.2655 },
  { id: '00000000-0000-4000-8000-0000000000a2', name: 'Ana Rodríguez', lat: 26.0611, lng: -80.2350 },
];
const JOBS = [
  { id: 'j1', tech: 0, order: 1, status: 'en_route', name: 'Familia Pérez', lat: 26.0745, lng: -80.2601 },
  { id: 'j2', tech: 0, order: 2, status: 'pending', name: 'Johnson Residence', lat: 26.0790, lng: -80.2532 },
  { id: 'j3', tech: 1, order: 1, status: 'in_progress', name: 'Casa Gómez', lat: 26.0611, lng: -80.2350 },
  { id: 'j4', tech: 1, order: 2, status: 'pending', name: 'Williams Pool', lat: 26.0553, lng: -80.2280 },
];

const locRow = (i: number, lat: number, lng: number) => ({
  technician_id: TECHS[i].id, company_id: COMPANY, lat, lng, heading: 0, speed_mps: 12, current_job_id: null,
  is_simulated: true, updated_at: now(),
});

async function mockRest(page: Page) {
  await page.route(/\/rest\/v1\/cadenza_technician_locations/, (route) =>
    route.fulfill({ json: TECHS.map((t, i) => ({ ...locRow(i, t.lat, t.lng), technician: { full_name: t.name } })) }));
  await page.route(/\/rest\/v1\/cadenza_service_jobs/, (route) => {
    const select = decodeURIComponent(new URL(route.request().url()).searchParams.get('select') ?? '');
    if (!/\blat\b/.test(select)) return route.fallback(); // live status board → real (QA) data
    return route.fulfill({ json: JOBS.map((j) => ({
      id: j.id, status: j.status, technician_id: TECHS[j.tech].id, route_order: j.order,
      technician: { id: TECHS[j.tech].id, full_name: TECHS[j.tech].name },
      property: { id: `p-${j.id}`, customer_name: j.name, address: 'Davie, FL', lat: j.lat, lng: j.lng },
    })) });
  });
}

type Binding = { id: number; event: string; schema: string; table: string; filter?: string };
type Channel = { topic: string; joinRef: string; bindings: Binding[] };

/** Minimal Phoenix (vsn 1.0.0 JSON) realtime server stub. */
async function mockRealtime(page: Page) {
  const channels: Channel[] = [];
  let ws: WebSocketRoute | null = null;
  let nextId = 1000;
  await page.routeWebSocket(/\/realtime\/v1\/websocket/, (route) => {
    ws = route;
    route.onMessage((raw) => {
      const msg = JSON.parse(String(raw)) as { topic: string; event: string; payload: Record<string, unknown>; ref: string; join_ref?: string };
      const reply = (response: unknown) => route.send(JSON.stringify({ topic: msg.topic, event: 'phx_reply', ref: msg.ref, join_ref: msg.join_ref, payload: { status: 'ok', response } }));
      if (msg.event === 'phx_join') {
        const cfg = ((msg.payload.config as { postgres_changes?: Omit<Binding, 'id'>[] })?.postgres_changes ?? []);
        const bindings = cfg.map((c) => ({ ...c, id: nextId++ }));
        channels.push({ topic: msg.topic, joinRef: msg.join_ref ?? msg.ref, bindings });
        reply({ postgres_changes: bindings });
        setTimeout(() => route.send(JSON.stringify({ topic: msg.topic, event: 'system', ref: null, payload: { status: 'ok', message: 'Subscribed to PostgreSQL', extension: 'postgres_changes', channel: msg.topic.replace(/^realtime:/, '') } })), 50);
      } else {
        reply({}); // heartbeat, access_token, phx_leave
      }
    });
  });

  return async function push(table: string, type: 'INSERT' | 'UPDATE' | 'DELETE', record: Record<string, unknown>) {
    expect(ws, 'realtime socket opened').not.toBeNull();
    for (const ch of channels.filter((c) => c.topic.includes('technician-map'))) {
      const ids = ch.bindings.filter((b) => b.table === table && (b.event === '*' || b.event === type)).map((b) => b.id);
      if (!ids.length) continue;
      ws!.send(JSON.stringify({ topic: ch.topic, event: 'postgres_changes', ref: null, join_ref: ch.joinRef, payload: { ids, data: {
        schema: 'public', table, type, commit_timestamp: now(), errors: null,
        columns: Object.keys(record).map((name) => ({ name, type: 'text' })),
        record: type === 'DELETE' ? {} : record, old_record: type === 'DELETE' ? record : {},
      } } }));
    }
  };
}

async function fillPassword(locator: Locator, password: string) {
  await test.step('Enter password', async () => {
    await locator.evaluate((el, value) => {
      const input = el as HTMLInputElement;
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, password);
  });
}

test('technician map shows live dots, pins and moves on realtime updates', async ({ page }) => {
  test.setTimeout(120_000);
  await mockRest(page);
  const push = await mockRealtime(page);

  await page.goto(`${BASE}/en/auth/login`);
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await fillPassword(page.getByLabel(/password/i), ADMIN_PASSWORD!);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.includes('/auth'), { timeout: 30_000 });
  if (!/\/dashboard/.test(page.url())) await page.goto(`${BASE}/en/dashboard`);

  const map = page.getByTestId('technician-map');
  await map.waitFor({ state: 'attached', timeout: 30_000 });
  await map.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await expect(map).toBeVisible({ timeout: 30_000 });
  await expect(map).toHaveAttribute('data-provider', 'maplibre');
  await expect(page.getByTestId('tech-map-live')).toBeVisible({ timeout: 20_000 });

  const dots = page.getByTestId('tech-map-tech-dot');
  await expect(dots).toHaveCount(2, { timeout: 30_000 });
  await expect(page.getByTestId('tech-map-job-pin')).toHaveCount(4);
  await expect(page.getByTestId('tech-map-count')).toContainText('2 technicians · 4 stops');
  // bring the whole map into view for the recording (dashboard scrolls inside its main container)
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(600);

  const carlos = page.locator(`[data-testid="tech-map-tech-dot"][data-tech-id="${TECHS[0].id}"]`);
  const ana = page.locator(`[data-testid="tech-map-tech-dot"][data-tech-id="${TECHS[1].id}"]`);
  await expect(carlos).toHaveAttribute('data-status', 'en_route');
  await expect(ana).toHaveAttribute('data-status', 'in_progress');

  await carlos.hover();
  await expect(page.getByTestId('tech-map-tooltip').filter({ hasText: 'Carlos Méndez' })).toBeVisible();
  await page.waitForTimeout(800);
  await page.mouse.move(5, 5);

  // Drive Carlos to his first stop over a few realtime ticks
  const start = TECHS[0], dest = JOBS[0];
  for (let k = 1; k <= 5; k++) {
    const lat = +(start.lat + ((dest.lat - start.lat) * k) / 5).toFixed(6);
    const lng = +(start.lng + ((dest.lng - start.lng) * k) / 5).toFixed(6);
    await push('cadenza_technician_locations', 'UPDATE', locRow(0, lat, lng));
    await expect(carlos).toHaveAttribute('data-lat', lat.toFixed(6));
    await page.waitForTimeout(700);
  }
  await expect(carlos).toHaveAttribute('data-lng', dest.lng.toFixed(6));

  // Arrival → job in_progress → dot turns amber
  await push('cadenza_service_jobs', 'UPDATE', { id: 'j1', status: 'in_progress', technician_id: TECHS[0].id, route_order: 1, company_id: COMPANY });
  await expect(carlos).toHaveAttribute('data-status', 'in_progress');
  await page.waitForTimeout(800);

  // Ana finishes all her stops → green
  await push('cadenza_service_jobs', 'UPDATE', { id: 'j3', status: 'completed', technician_id: TECHS[1].id, route_order: 1, company_id: COMPANY });
  await push('cadenza_service_jobs', 'UPDATE', { id: 'j4', status: 'completed', technician_id: TECHS[1].id, route_order: 2, company_id: COMPANY });
  await expect(ana).toHaveAttribute('data-status', 'completed');
  await expect(page.locator('[data-testid="tech-map-job-pin"][data-status="completed"]')).toHaveCount(2);
  await page.waitForTimeout(800);

  // Simulator cleanup (DELETE) removes the dot
  await push('cadenza_technician_locations', 'DELETE', { technician_id: TECHS[1].id, company_id: COMPANY });
  await expect(dots).toHaveCount(1);
  await page.waitForTimeout(1000);
});
