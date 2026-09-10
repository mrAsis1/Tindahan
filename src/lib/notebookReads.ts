import { z } from 'zod';
import type { StoreData } from '../types';
import { balance, balancesByCustomer, chronological, dailySummary } from './ledger';
import { storeNow, validDate } from './dates';
import { storeSchema } from './validation';

export type NotebookView =
  | { kind: 'full' }
  | { kind: 'directory' }
  | { kind: 'home'; day: string }
  | { kind: 'day'; day: string }
  | { kind: 'customer'; customerId: string };

const cents = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const readTotalsSchema = z.object({
  outstanding: cents,
  withBalance: z.number().int().nonnegative(),
  balances: z.array(z.object({ customerId: z.string().min(1), amount: cents })),
  utang: cents,
  payments: cents,
  opening: cents,
  closing: cents,
});
export type ReadTotals = z.infer<typeof readTotalsSchema>;
export interface NotebookRead {
  notebook: StoreData;
  totals: ReadTotals | null;
}
export const notebookReadSchema = z.object({
  notebook: storeSchema.extend({ store: z.object({ id: z.uuid(), name: z.string() }).nullable() }),
  totals: readTotalsSchema,
});

// Writes/confirmations keep the complete notebook. Scoped snapshots are only
// supplied to screens that explicitly consume their accompanying totals.
export function viewForRoute(path: string, search: string): NotebookView {
  try {
    path = decodeURI(path);
  } catch {
    /* Router handles malformed URLs. */
  }
  path = path.replace(/\/+$/, '') || '/';
  const route = path.toLowerCase();
  if (route === '/home' || route === '/') return { kind: 'home', day: storeNow().date };
  if (route === '/customers' || route === '/search') return { kind: 'directory' };
  if (route === '/daily-record') {
    const today = storeNow().date;
    const day = new URLSearchParams(search).get('date') ?? today;
    return { kind: 'day', day: validDate(day) && day <= today ? day : today };
  }
  const customer = /^\/customers\/([^/]+)$/i.exec(path)?.[1];
  if (customer && customer.toLowerCase() !== 'new') {
    try {
      return { kind: 'customer', customerId: decodeURIComponent(customer) };
    } catch {
      return { kind: 'full' };
    }
  }
  return { kind: 'full' };
}

// Local demo projection and fictional API oracle. Never persisted as a notebook.
export function projectNotebook(notebook: StoreData, view: NotebookView): NotebookRead {
  if (view.kind === 'full') return { notebook, totals: null };
  const balances = balancesByCustomer(notebook.entries);
  const day = 'day' in view ? view.day : '';
  const daily = dailySummary(notebook.entries, day);
  const entries =
    view.kind === 'directory'
      ? []
      : view.kind === 'home'
        ? chronological(notebook.entries).reverse().slice(0, 3)
        : view.kind === 'day'
          ? daily.entries
          : chronological(
              notebook.entries.filter((e) => e.customerId === view.customerId),
            ).reverse();
  const ids = new Set(entries.map((e) => e.customerId));
  const customers = notebook.customers.filter(
    (c) =>
      view.kind === 'directory' ||
      (view.kind === 'customer' ? c.id === view.customerId : ids.has(c.id)),
  );
  return {
    notebook: { version: 1, store: notebook.store, customers, entries },
    totals: {
      outstanding: balance(notebook.entries),
      withBalance: notebook.customers.filter((c) => (balances.get(c.id) ?? 0) > 0).length,
      balances:
        view.kind === 'directory'
          ? notebook.customers.map((c) => ({ customerId: c.id, amount: balances.get(c.id) ?? 0 }))
          : [],
      utang: daily.utang,
      payments: daily.payments,
      opening: daily.opening,
      closing: daily.closing,
    },
  };
}
