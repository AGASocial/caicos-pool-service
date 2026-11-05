/**
 * Delete Stripe TEST-mode customers whose email matches qa-billing-*@cadenzaops.com
 * (cancelling their subscriptions first). Hard-aborts unless the key is sk_test_.
 * Uses STRIPE_TEST_SECRET_KEY, falling back to STRIPE_SECRET_KEY. Skips if none set.
 * Never logs the key.
 */
const EMAIL_RE = /^qa-billing-[a-z0-9-]+@cadenzaops\.com$/i;

export async function cleanupStripeQaCustomers(opts: { emailPrefix?: string } = {}): Promise<number> {
  const key = process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
  if (!key) { console.log('🧹 Stripe QA cleanup skipped: no Stripe key configured'); return 0; }
  if (!key.startsWith('sk_test_')) throw new Error('ABORT Stripe cleanup: key is not a test-mode (sk_test_) key');
  const prefix = (opts.emailPrefix ?? 'qa-billing-').toLowerCase();
  if (!prefix.startsWith('qa-billing-')) throw new Error('Refusing Stripe cleanup: prefix must start with qa-billing-');

  const auth = { Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}` };
  const api = async (method: string, path: string) => {
    const r = await fetch(`https://api.stripe.com/v1/${path}`, { method, headers: auth });
    const j = await r.json();
    if (!r.ok) throw new Error(`Stripe ${method} ${path.split('?')[0]}: ${j?.error?.message ?? r.status}`);
    return j;
  };

  let deleted = 0;
  let page: string | undefined;
  const seen = new Set<string>();
  for (let i = 0; i < 20; i++) {
    const q = encodeURIComponent(`email~'qa-billing-'`);
    const res = await api('GET', `customers/search?limit=100&query=${q}${page ? `&page=${page}` : ''}`);
    for (const c of res.data ?? []) {
      const email = String(c.email ?? '').toLowerCase();
      if (seen.has(c.id) || c.livemode || !EMAIL_RE.test(email) || !email.startsWith(prefix)) continue;
      seen.add(c.id);
      try {
        const subs = await api('GET', `subscriptions?customer=${c.id}&status=all&limit=100`);
        for (const s of subs.data ?? []) {
          if (!['canceled', 'incomplete_expired'].includes(s.status)) await api('DELETE', `subscriptions/${s.id}`);
        }
        await api('DELETE', `customers/${c.id}`);
        deleted++;
      } catch (e) {
        console.warn(`Stripe cleanup ${c.id}: ${e instanceof Error ? e.message : e}`);
      }
    }
    if (!res.has_more || !res.next_page) break;
    page = encodeURIComponent(res.next_page);
  }
  console.log(`🧹 Stripe QA cleanup: ${deleted} test customer(s) deleted`);
  return deleted;
}
