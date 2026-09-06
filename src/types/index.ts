export interface Customer {
  id: string;
  name: string;
  contactNumber: string;
  identifyingNote: string;
  createdAt: string;
}

export type EntryType = 'opening_balance' | 'utang' | 'payment';
export interface LedgerEntry {
  id: string;
  requestId: string;
  customerId: string;
  type: EntryType;
  amountCentavos: number;
  description: string;
  effectiveDate: string;
  effectiveTime: string;
  createdAt: string;
}

export interface StoreData {
  version: 1;
  customers: Customer[];
  entries: LedgerEntry[];
}

export type NewCustomer = Pick<Customer, 'name' | 'contactNumber' | 'identifyingNote'>;
export type NewEntry = Pick<
  LedgerEntry,
  'customerId' | 'type' | 'amountCentavos' | 'description' | 'effectiveDate'
>;
