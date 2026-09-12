import type { CorrectionInput, LedgerEntry, NewCustomer, NewEntry, StoreData } from '../../types';
import { assertLedger } from '../ledger';
import { correctionSchema, customerSchema, newEntrySchema, storeSchema } from '../validation';
import { storeNow } from '../dates';
import { createSeed } from './seed';
import { sameCustomer, duplicateCustomerMessage } from '../customerIdentity';
import type { Repository } from './repository';

export const STORAGE_KEY = 'tindahan.local-demo.v1';

// TEMPORARY demo adapter. Replace at the provider boundary with authenticated
// Supabase reads and atomic RPC writes. localStorage is not a production database.
export function createLocalRepository(storage: Pick<Storage, 'getItem' | 'setItem'>) {
  function read(): StoreData {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return createSeed();
    try {
      const data = storeSchema.parse(JSON.parse(raw));
      assertLedger(data);
      return data;
    } catch {
      throw new Error(
        'Saved demo data could not be read. It has been kept unchanged. Use Reset demo to replace it with fictional records.',
      );
    }
  }
  function persist(data: StoreData) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      throw new Error(
        'Couldn’t save to this browser. Your details are still here—allow browser storage and try again.',
      );
    }
  }
  // Serializes this demo's writes across same-origin tabs where Web Locks exists.
  async function write<T>(operation: () => T): Promise<T> {
    if (typeof window !== 'undefined' && window.navigator.locks)
      return window.navigator.locks.request(STORAGE_KEY, operation);
    return operation();
  }
  return {
    async getData() {
      return read();
    },
    async createCustomer(input: NewCustomer, requestId: string) {
      return write(() => {
        const values = customerSchema.parse(input);
        const data = read();
        const existing = data.customers.find((c) => c.id === requestId);
        if (existing) {
          if (
            Object.entries(values).some(
              ([key, value]) => existing[key as keyof NewCustomer] !== value,
            )
          )
            throw new Error('This save ID was already used for different customer details.');
          return existing;
        }
        if (data.customers.some((c) => sameCustomer(c, values)))
          throw new Error(duplicateCustomerMessage);
        const customer = { ...values, id: requestId, createdAt: new Date().toISOString() };
        persist({ ...data, customers: [...data.customers, customer] });
        return customer;
      });
    },
    async recordEntry(input: NewEntry, requestId: string) {
      return write(() => {
        const values = newEntrySchema.parse(input);
        const data = read();
        if (data.corrections?.some((c) => c.requestId === requestId))
          throw new Error('This save ID was already used for a correction.');
        const existing = data.entries.find((e) => e.requestId === requestId);
        if (existing) {
          if (
            Object.entries(values).some(([key, value]) => existing[key as keyof NewEntry] !== value)
          )
            throw new Error('This save ID was already used for different transaction details.');
          return existing;
        }
        const entry: LedgerEntry = {
          ...values,
          id: requestId,
          requestId,
          effectiveTime: storeNow().time,
          createdAt: new Date().toISOString(),
        };
        const next = { ...data, entries: [...data.entries, entry] };
        assertLedger(next);
        persist(next);
        return entry;
      });
    },
    async correctEntry(input: CorrectionInput, requestId: string) {
      return write(() => {
        const values = correctionSchema.parse(input);
        const data = read();
        const retry = data.corrections?.find((c) => c.requestId === requestId);
        if (retry) {
          if (
            retry.entryId !== values.entryId ||
            retry.reason !== values.reason ||
            JSON.stringify(retry.replacement) !== JSON.stringify(values.replacement)
          )
            throw new Error('This save ID was already used for different correction details.');
          return;
        }
        if (data.entries.some((e) => e.id === requestId))
          throw new Error('This save ID was already used for a transaction.');
        const original = data.entries.find((e) => e.id === values.entryId);
        if (!original) throw new Error('Entry not found in your store.');
        if (original.status === 'voided')
          throw new Error('This entry has already been voided. Refresh its history.');
        const now = new Date().toISOString();
        const entries = data.entries.map((e) =>
          e.id === original.id
            ? {
                ...e,
                status: 'voided' as const,
                voidedAt: now,
                voidedBy: 'local-demo',
                voidReason: values.reason,
              }
            : e,
        );
        if (values.replacement)
          entries.push({
            ...original,
            ...values.replacement,
            id: requestId,
            requestId,
            createdAt: now,
            status: 'active',
            voidedAt: null,
            voidedBy: null,
            voidReason: null,
            replacesEntryId: original.id,
            orderCreatedAt: original.orderCreatedAt ?? original.createdAt,
            orderId: original.orderId ?? original.id,
          });
        const next: StoreData = {
          ...data,
          entries,
          corrections: [
            ...(data.corrections ?? []),
            { ...values, requestId, createdAt: now, createdBy: 'local-demo' },
          ],
        };
        assertLedger(next);
        persist(next);
      });
    },
    async reset(empty = false) {
      return write(() =>
        persist(empty ? { version: 1, customers: [], entries: [] } : createSeed()),
      );
    },
  } satisfies Repository & { reset(empty?: boolean): Promise<void> };
}
