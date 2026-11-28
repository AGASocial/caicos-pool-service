/**
 * Minimal in-memory Supabase fake for unit tests (KAN-153).
 *
 * Supports the query shapes used by the open-issue code: select (with `alias:table!fk(...)`
 * embeds), eq / neq / is / in / gte / lte / or, order, limit, maybeSingle / single, insert and
 * update. It is intentionally tiny; extend it only when a test needs more.
 */

export type Row = Record<string, unknown>;
export type FakeDb = Record<string, Row[]>;
type DbError = { code: string; message: string };

type Filter = (row: Row) => boolean;

type FakeOptions = {
  /** Columns that "do not exist" (simulates the migration not being applied). */
  missingColumns?: string[];
  rpc?: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: DbError | null }>;
};

let idCounter = 0;

function compare(row: Row, col: string, op: string, raw: string): boolean {
  const value = row[col];
  if (op === 'is') {
    if (raw === 'null') return value == null;
    return value === (raw === 'true');
  }
  if (op === 'eq') return String(value) === raw;
  if (op === 'neq') {
    if (raw === '{}') return Array.isArray(value) && value.length > 0;
    // SQL semantics: NULL <> 'x' is not true.
    return value != null && String(value) !== raw;
  }
  throw new Error(`fake-supabase: unsupported operator ${op}`);
}

function parseOr(expr: string): Filter {
  const terms = expr.split(',').map((term) => {
    const [col, op, ...rest] = term.split('.');
    return { col, op, raw: rest.join('.') };
  });
  return (row) => terms.some((t) => compare(row, t.col, t.op, t.raw));
}

class Builder implements PromiseLike<{ data: unknown; error: DbError | null }> {
  private filters: Filter[] = [];
  private orders: Array<{ col: string; asc: boolean }> = [];
  private limitN: number | null = null;
  private columns = '*';
  private mode: 'select' | 'update' | 'insert' = 'select';
  private patch: Row = {};
  private single_: 'none' | 'maybe' | 'one' = 'none';

  constructor(
    private readonly table: string,
    private readonly db: FakeDb,
    private readonly opts: FakeOptions,
  ) {}

  select(columns = '*') {
    this.columns = columns;
    return this;
  }
  update(patch: Row) {
    this.mode = 'update';
    this.patch = patch;
    return this;
  }
  insert(row: Row) {
    this.mode = 'insert';
    this.patch = row;
    return this;
  }
  eq(col: string, value: unknown) {
    this.filters.push((row) => row[col] === value || String(row[col]) === String(value));
    return this;
  }
  neq(col: string, value: unknown) {
    this.filters.push((row) => row[col] != null && String(row[col]) !== String(value));
    return this;
  }
  is(col: string, value: unknown) {
    this.filters.push((row) => (value === null ? row[col] == null : row[col] === value));
    return this;
  }
  in(col: string, values: unknown[]) {
    const set = new Set(values.map(String));
    this.filters.push((row) => set.has(String(row[col])));
    return this;
  }
  gte(col: string, value: string) {
    this.filters.push((row) => String(row[col]) >= value);
    return this;
  }
  lte(col: string, value: string) {
    this.filters.push((row) => String(row[col]) <= value);
    return this;
  }
  or(expr: string) {
    this.filters.push(parseOr(expr));
    return this;
  }
  order(col: string, opts: { ascending?: boolean } = {}) {
    this.orders.push({ col, asc: opts.ascending !== false });
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  maybeSingle() {
    this.single_ = 'maybe';
    return this;
  }
  single() {
    this.single_ = 'one';
    return this;
  }

  private missingColumnError(): DbError | null {
    const probe = this.mode === 'select' ? this.columns : Object.keys(this.patch).join(',');
    for (const col of this.opts.missingColumns ?? []) {
      if (new RegExp(`\\b${col}\\b`).test(probe)) {
        return { code: '42703', message: `column ${col} does not exist` };
      }
    }
    return null;
  }

  private embed(row: Row): Row {
    const out: Row = { ...row };
    const re = /(?:(\w+):)?(\w+)!(\w+)(?:!inner)?\(/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(this.columns))) {
      const [, alias, table, fk] = match;
      const target = (this.db[table] ?? []).find((r) => r.id === row[fk]);
      out[alias ?? table] = target ? { ...target } : null;
    }
    return out;
  }

  private run(): { data: unknown; error: DbError | null } {
    const missing = this.missingColumnError();
    if (missing) return { data: null, error: missing };

    const rows = this.db[this.table] ?? (this.db[this.table] = []);

    if (this.mode === 'insert') {
      const created: Row = { id: `gen-${++idCounter}`, created_at: new Date().toISOString(), ...this.patch };
      rows.push(created);
      return this.finish([created]);
    }

    let matched = rows.filter((row) => this.filters.every((f) => f(row)));
    if (this.mode === 'update') {
      matched.forEach((row) => Object.assign(row, this.patch));
      return this.finish(matched);
    }

    for (const { col, asc } of [...this.orders].reverse()) {
      matched = [...matched].sort((a, b) => {
        const av = String(a[col] ?? '');
        const bv = String(b[col] ?? '');
        return asc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    if (this.limitN != null) matched = matched.slice(0, this.limitN);
    return this.finish(matched);
  }

  private finish(rows: Row[]): { data: unknown; error: DbError | null } {
    const projected = rows.map((row) => this.embed(row));
    if (this.single_ === 'none') return { data: projected, error: null };
    if (projected.length === 0) {
      return this.single_ === 'maybe'
        ? { data: null, error: null }
        : { data: null, error: { code: 'PGRST116', message: 'no rows' } };
    }
    return { data: projected[0], error: null };
  }

  then<R1 = { data: unknown; error: DbError | null }, R2 = never>(
    onfulfilled?: ((value: { data: unknown; error: DbError | null }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

export function createFakeSupabase(db: FakeDb, opts: FakeOptions = {}) {
  return {
    from: (table: string) => new Builder(table, db, opts),
    rpc: (name: string, args: Record<string, unknown>) =>
      opts.rpc
        ? opts.rpc(name, args)
        : Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'function not found' } }),
  };
}
