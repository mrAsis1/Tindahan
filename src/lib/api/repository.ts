import type { Customer, LedgerEntry, NewCustomer, NewEntry, StoreData } from '../../types';

export interface Repository {
  getData(): Promise<StoreData>;
  createCustomer(input: NewCustomer, requestId: string): Promise<Customer>;
  recordEntry(input: NewEntry, requestId: string): Promise<LedgerEntry>;
}
