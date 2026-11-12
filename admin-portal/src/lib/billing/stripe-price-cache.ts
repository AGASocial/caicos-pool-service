/**
 * In-memory cache for Stripe price id <-> lookup_key resolution.
 * Module-scoped so adapter instances share results within a process.
 */

const priceIdByLookupKey = new Map<string, string>();
const lookupKeyByPriceId = new Map<string, string>();

export function getCachedPriceId(lookupKey: string): string | undefined {
  return priceIdByLookupKey.get(lookupKey);
}

export function getCachedLookupKey(priceId: string): string | undefined {
  return lookupKeyByPriceId.get(priceId);
}

export function setCachedPriceMapping(lookupKey: string, priceId: string): void {
  priceIdByLookupKey.set(lookupKey, priceId);
  lookupKeyByPriceId.set(priceId, lookupKey);
}

/** Test helper — clears all cached mappings */
export function clearStripePriceCache(): void {
  priceIdByLookupKey.clear();
  lookupKeyByPriceId.clear();
}
