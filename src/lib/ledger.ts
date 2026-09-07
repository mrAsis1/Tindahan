import type { LedgerEntry, StoreData } from '../types';

export const signedAmount = (entry: LedgerEntry) =>
  entry.status === 'voided'
    ? 0
    : entry.type === 'payment'
      ? -entry.amountCentavos
      : entry.amountCentavos;
export const chronological = (entries: LedgerEntry[]) =>
  [...entries].sort(
    (a, b) =>
      a.effectiveDate.localeCompare(b.effectiveDate) ||
      a.effectiveTime.localeCompare(b.effectiveTime) ||
      (a.orderCreatedAt ?? a.createdAt).localeCompare(b.orderCreatedAt ?? b.createdAt) ||
      (a.orderId ?? a.id).localeCompare(b.orderId ?? b.id) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
export const balance = (entries: LedgerEntry[], customerId?: string) =>
  entries
    .filter((e) => !customerId || e.customerId === customerId)
    .reduce((total, entry) => total + signedAmount(entry), 0);

export function history(entries: LedgerEntry[], customerId: string) {
  let runningBalance = 0;
  return chronological(entries.filter((e) => e.customerId === customerId))
    .map((entry) => {
      runningBalance += signedAmount(entry);
      return { ...entry, runningBalance };
    })
    .reverse();
}

export function assertLedger(data: StoreData) {
  const customers = new Set(data.customers.map((c) => c.id));
  const ids = new Set<string>();
  const requests = new Set<string>();
  const balances = new Map<string, number>();
  if (customers.size !== data.customers.length)
    throw new Error('Duplicate customer IDs in saved data.');
  for (const entry of chronological(data.entries)) {
    if (!customers.has(entry.customerId) || ids.has(entry.id) || requests.has(entry.requestId))
      throw new Error('Saved ledger contains an invalid reference or duplicate entry.');
    ids.add(entry.id);
    requests.add(entry.requestId);
    const next = (balances.get(entry.customerId) ?? 0) + signedAmount(entry);
    if (next < 0)
      throw new Error(
        'Payment exceeds the available balance on this date. Choose a later date or a smaller amount.',
      );
    if (!Number.isSafeInteger(next)) throw new Error('Balance is too large to store safely.');
    balances.set(entry.customerId, next);
  }
  if (!Number.isSafeInteger(balance(data.entries)))
    throw new Error('Store balance is too large to store safely.');
}

export function dailySummary(entries: LedgerEntry[], date: string) {
  const daily = entries.filter((e) => e.effectiveDate === date);
  const sum = (type: LedgerEntry['type']) =>
    daily
      .filter((e) => e.type === type && e.status !== 'voided')
      .reduce((total, e) => total + e.amountCentavos, 0);
  return {
    entries: chronological(daily).reverse(),
    utang: sum('utang'),
    payments: sum('payment'),
    opening: sum('opening_balance'),
    closing: balance(entries.filter((e) => e.effectiveDate <= date)),
  };
}
