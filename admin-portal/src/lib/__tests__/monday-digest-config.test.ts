import {
  hasMondayDigestAllowList,
  isAllowedDigestRecipient,
  isMondayDigestEnabled,
  parseMondayDigestCompanyIds,
  weekStartMonday,
} from '../monday-digest-config';

const env = (vars: Record<string, string | undefined>) => vars as unknown as NodeJS.ProcessEnv;

describe('isMondayDigestEnabled (AC-3)', () => {
  it.each(['1', 'true', 'TRUE', 'Yes', 'yes', ' true '])('is on for %p', (value) => {
    expect(isMondayDigestEnabled(env({ MONDAY_DIGEST_ENABLED: value }))).toBe(true);
  });

  it.each([undefined, '', '0', 'false', 'no', 'off', 'enabled', '2', 'y'])('is off for %p', (value) => {
    expect(isMondayDigestEnabled(env({ MONDAY_DIGEST_ENABLED: value }))).toBe(false);
  });
});

describe('isAllowedDigestRecipient (AC-4)', () => {
  const preview = env({ VERCEL_ENV: 'preview' });
  const production = env({ VERCEL_ENV: 'production' });

  it('outside production allows only qa-billing-*@cadenzaops.com', () => {
    expect(isAllowedDigestRecipient('qa-billing-abc123@cadenzaops.com', preview)).toBe(true);
    expect(isAllowedDigestRecipient('QA-Billing-ABC-late@CadenzaOps.com', preview)).toBe(true);
    expect(isAllowedDigestRecipient('office@example.com', preview)).toBe(false);
    expect(isAllowedDigestRecipient('qa-billing-abc@example.com', preview)).toBe(false);
    expect(isAllowedDigestRecipient('qa-billing-abc@cadenzaops.com.evil.test', preview)).toBe(false);
    expect(isAllowedDigestRecipient('x-qa-billing-abc@cadenzaops.com', preview)).toBe(false);
    expect(isAllowedDigestRecipient('qa-billing-@cadenzaops.com', preview)).toBe(false);
  });

  it('treats an unset VERCEL_ENV (local / development) as non-production', () => {
    expect(isAllowedDigestRecipient('office@example.com', env({}))).toBe(false);
    expect(isAllowedDigestRecipient('office@example.com', env({ VERCEL_ENV: 'development' }))).toBe(false);
    expect(isAllowedDigestRecipient('qa-billing-a@cadenzaops.com', env({}))).toBe(true);
  });

  it('in production allows well-formed office addresses', () => {
    expect(isAllowedDigestRecipient('office@example.com', production)).toBe(true);
    expect(isAllowedDigestRecipient('not an email', production)).toBe(false);
    expect(isAllowedDigestRecipient('a@b.com, c@d.com', production)).toBe(false);
  });

  it('rejects empty values and cannot be overridden by the enable flag', () => {
    expect(isAllowedDigestRecipient('', production)).toBe(false);
    expect(isAllowedDigestRecipient(null, preview)).toBe(false);
    expect(
      isAllowedDigestRecipient('office@example.com', env({ VERCEL_ENV: 'preview', MONDAY_DIGEST_ENABLED: '1' })),
    ).toBe(false);
  });
});

describe('parseMondayDigestCompanyIds (AC-5)', () => {
  const A = '11111111-1111-4111-8111-111111111111';
  const B = '22222222-2222-4222-8222-222222222222';

  it('returns [] when unset', () => {
    expect(parseMondayDigestCompanyIds(env({}))).toEqual([]);
    expect(hasMondayDigestAllowList(env({}))).toBe(false);
  });

  it('parses, trims, lowercases, dedupes and drops invalid entries', () => {
    const raw = ` ${A.toUpperCase()}, ${B},not-a-uuid,${A},, `;
    expect(parseMondayDigestCompanyIds(env({ MONDAY_DIGEST_COMPANY_IDS: raw }))).toEqual([A, B]);
  });

  it('flags an allow-list that is set but holds no valid id', () => {
    const vars = env({ MONDAY_DIGEST_COMPANY_IDS: 'nope' });
    expect(parseMondayDigestCompanyIds(vars)).toEqual([]);
    expect(hasMondayDigestAllowList(vars)).toBe(true);
  });
});

describe('weekStartMonday (America/New_York)', () => {
  it('returns the same Monday for any time on that Monday (NY local)', () => {
    expect(weekStartMonday(new Date('2026-11-30T12:00:00Z'))).toBe('2026-11-30'); // 07:00 EST
    expect(weekStartMonday(new Date('2026-11-30T05:30:00Z'))).toBe('2026-11-30'); // 00:30 EST
  });

  it('keeps Sunday evening New York time in the previous week', () => {
    // 2026-11-30T04:00Z is still Sunday 23:00 in New York.
    expect(weekStartMonday(new Date('2026-11-30T04:00:00Z'))).toBe('2026-11-23');
  });

  it('maps mid-week and weekend days back to Monday', () => {
    expect(weekStartMonday(new Date('2026-11-27T20:00:00Z'))).toBe('2026-11-23'); // Friday
    expect(weekStartMonday(new Date('2026-11-29T18:00:00Z'))).toBe('2026-11-23'); // Sunday
  });

  it('is DST safe (Monday after the spring-forward Sunday, and the fall-back week)', () => {
    expect(weekStartMonday(new Date('2026-03-09T12:00:00Z'))).toBe('2026-03-09');
    expect(weekStartMonday(new Date('2026-11-01T12:00:00Z'))).toBe('2026-10-26');
  });
});
