import type { NewCustomer } from '../types';

export const customerText = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
export const sameCustomer = (a: NewCustomer, b: NewCustomer) =>
  (['name', 'contactNumber', 'identifyingNote'] as const).every(
    (key) => customerText(a[key]) === customerText(b[key]),
  );
export const duplicateCustomerMessage =
  'This customer already exists. Use the existing customer, or add different contact details or an identifying note for a different person.';
