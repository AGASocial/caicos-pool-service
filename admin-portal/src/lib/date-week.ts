/** Local calendar YYYY-MM-DD (no UTC shift). */
export function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Monday–Sunday bounds for the week containing `ref` (Monday = start). */
export function weekBoundsMonday(ref: Date = new Date()): { from: string; to: string } {
  const dow = ref.getDay();
  const offsetToMon = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(ref);
  mon.setDate(ref.getDate() + offsetToMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { from: formatLocalYmd(mon), to: formatLocalYmd(sun) };
}
