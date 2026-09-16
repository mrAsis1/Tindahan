export interface Customer {
  id: string;
  name: string;
  contactNumber: string;
  identifyingNote: string;
  createdAt: string;
  deleted?: boolean;
  revision?: number;
  changes?: CustomerChange[];
}

export interface CustomerChangeInput {
  customerId: string;
  expectedRevision: number;
  details: NewCustomer;
  deleted: boolean;
}
export interface CustomerChange extends CustomerChangeInput {
  requestId: string;
  before: NewCustomer & { deleted: boolean };
  after: NewCustomer & { deleted: boolean };
  createdAt: string;
  createdBy: string;
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
  status?: 'active' | 'voided';
  voidedAt?: string | null;
  voidedBy?: string | null;
  voidReason?: string | null;
  replacesEntryId?: string | null;
  orderCreatedAt?: string | null;
  orderId?: string | null;
}

export interface StoreData {
  version: 1;
  store?: { id: string; name: string } | null;
  customers: Customer[];
  entries: LedgerEntry[];
  corrections?: CorrectionRecord[];
}

export interface CorrectionInput {
  entryId: string;
  reason: string;
  replacement: Pick<NewEntry, 'amountCentavos' | 'description' | 'effectiveDate'> | null;
}
export interface CorrectionRecord extends CorrectionInput {
  requestId: string;
  createdAt: string;
  createdBy: string;
}

export type NewCustomer = Pick<Customer, 'name' | 'contactNumber' | 'identifyingNote'>;
export type NewEntry = Pick<
  LedgerEntry,
  'customerId' | 'type' | 'amountCentavos' | 'description' | 'effectiveDate'
>;
