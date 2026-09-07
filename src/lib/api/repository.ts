import type {
  CorrectionInput,
  Customer,
  LedgerEntry,
  NewCustomer,
  NewEntry,
  StoreData,
} from '../../types';

export interface Repository {
  getData(): Promise<StoreData>;
  createCustomer(input: NewCustomer, requestId: string): Promise<Customer>;
  recordEntry(input: NewEntry, requestId: string): Promise<LedgerEntry>;
  correctEntry(input: CorrectionInput, requestId: string): Promise<void>;
}
