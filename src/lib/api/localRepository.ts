import type {
  CorrectionInput,
  CustomerChangeInput,
  LedgerEntry,
  NewCustomer,
  NewEntry,
  StoreData,
} from '../../types';
import { assertLedger } from '../ledger';
import {
  correctionSchema,
  customerChangeSchema,
  customerSchema,
  newEntrySchema,
  storeSchema,
} from '../validation';
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
    async changeCustomer(input: CustomerChangeInput, requestId: string) {
      return write(() => {
        const values = customerChangeSchema.parse(input);
        if (!requestId) throw new Error('A save ID is required.');
        const data = read();
        const customer = data.customers.find((c) => c.id === values.customerId);
        if (!customer) throw new Error('Customer not found in your store.');
        const prior = data.customers
          .flatMap((c) => c.changes ?? [])
          .find((c) => c.requestId === requestId);
        if (prior) {
          if (
            prior.customerId !== values.customerId ||
            prior.expectedRevision !== values.expectedRevision ||
            prior.deleted !== values.deleted ||
            JSON.stringify(prior.details) !== JSON.stringify(values.details)
          )
            throw new Error('This save ID was already used for different customer changes.');
          return;
        }
        if (
          data.customers.some((c) => c.id === requestId) ||
          data.entries.some((e) => e.requestId === requestId) ||
          data.corrections?.some((c) => c.requestId === requestId)
        )
          throw new Error('This save ID was already used.');
        if ((customer.revision ?? 0) !== values.expectedRevision)
          throw new Error(
            'This customer changed since you opened the form. Reopen it to see the latest details.',
          );
        if (
          JSON.stringify(customerSchema.parse(customer)) !== JSON.stringify(values.details) &&
          data.customers.some((c) => c.id !== customer.id && sameCustomer(c, values.details))
        )
          throw new Error(duplicateCustomerMessage);
        const before = { ...customerSchema.parse(customer), deleted: customer.deleted ?? false };
        const after = { ...values.details, deleted: values.deleted };
        if (JSON.stringify(before) === JSON.stringify(after)) return;
        const change = {
          ...values,
          requestId,
          before,
          after,
          createdAt: new Date().toISOString(),
          createdBy: 'local-demo',
        };
        persist({
          ...data,
          customers: data.customers.map((c) =>
            c.id === customer.id
              ? {
                  ...c,
                  ...after,
                  revision: values.expectedRevision + 1,
                  changes: [...(c.changes ?? []), change],
                }
              : c,
          ),
        });
      });
    },
    async recordEntry(input: NewEntry, requestId: string) {
      return write(() => {
        const values = newEntrySchema.parse(input);
        const data = read();
        if (data.corrections?.some((c) => c.requestId === requestId))
          throw new Error('This save ID was already used for a correction.');
        if (data.customers.some((c) => c.changes?.some((change) => change.requestId === requestId)))
          throw new Error('This save ID was already used for a customer change.');
        const existing = data.entries.find((e) => e.requestId === requestId);
        if (existing) {
          if (
            Object.entries(values).some(([key, value]) => existing[key as keyof NewEntry] !== value)
          )
            throw new Error('This save ID was already used for different transaction details.');
          return existing;
        }
        if (data.customers.find((c) => c.id === values.customerId)?.deleted)
          throw new Error('Restore this deleted customer before recording new entries.');
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
        if (data.customers.some((c) => c.changes?.some((change) => change.requestId === requestId)))
          throw new Error('This save ID was already used for a customer change.');
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
