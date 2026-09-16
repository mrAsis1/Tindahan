import { z } from 'zod';
import { storeNow, validDate } from './dates';
import { MAX_CENTAVOS, parseMoney } from './money';

export const customerSchema = z.object({
  name: z.string().trim().min(1, 'Enter a customer name.').max(100, 'Use 100 characters or fewer.'),
  contactNumber: z.string().trim().max(40, 'Use 40 characters or fewer.'),
  identifyingNote: z.string().trim().max(160, 'Use 160 characters or fewer.'),
});
export const dateSchema = z
  .string()
  .refine(validDate, 'Choose a valid date.')
  .refine((d) => d <= storeNow().date, 'Choose today or an earlier date.');
export const transactionSchema = z.object({
  customerId: z.string().min(1, 'Select a customer.'),
  amount: z
    .string()
    .refine(
      (v) => parseMoney(v) !== null,
      'Enter a positive amount with up to two decimals (maximum ₱9,999,999.99).',
    ),
  description: z.string().trim().max(300, 'Use 300 characters or fewer.'),
  effectiveDate: dateSchema,
});
export const newEntrySchema = transactionSchema.omit({ amount: true }).extend({
  type: z.enum(['utang', 'payment', 'opening_balance']),
  amountCentavos: z.number().int().positive().max(MAX_CENTAVOS),
});
export const correctionSchema = z.object({
  entryId: z.string().min(1),
  reason: z
    .string()
    .trim()
    .min(1, 'Enter a reason for this correction.')
    .max(300, 'Use 300 characters or fewer.'),
  replacement: newEntrySchema
    .pick({ amountCentavos: true, description: true, effectiveDate: true })
    .nullable(),
});
export const customerChangeSchema = z.object({
  customerId: z.string().min(1),
  expectedRevision: z.number().int().nonnegative(),
  details: customerSchema,
  deleted: z.boolean(),
});
export const savedCustomerSchema = customerSchema.extend({
  id: z.string().min(1),
  createdAt: z.iso.datetime(),
  deleted: z.boolean().optional(),
  revision: z.number().int().nonnegative().optional(),
  changes: z
    .array(
      customerChangeSchema.extend({
        requestId: z.string().min(1),
        before: customerSchema.extend({ deleted: z.boolean() }),
        after: customerSchema.extend({ deleted: z.boolean() }),
        createdAt: z.iso.datetime(),
        createdBy: z.string().min(1),
      }),
    )
    .optional(),
});
export const storeSchema = z.object({
  version: z.literal(1),
  customers: z.array(savedCustomerSchema),
  entries: z.array(
    newEntrySchema.extend({
      id: z.string().min(1),
      requestId: z.string().min(1),
      createdAt: z.iso.datetime(),
      effectiveTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/),
      status: z.enum(['active', 'voided']).optional(),
      voidedAt: z.iso.datetime().nullable().optional(),
      voidedBy: z.string().nullable().optional(),
      voidReason: z.string().nullable().optional(),
      replacesEntryId: z.string().nullable().optional(),
      orderCreatedAt: z.iso.datetime().nullable().optional(),
      orderId: z.string().nullable().optional(),
    }),
  ),
  corrections: z
    .array(
      correctionSchema.extend({
        requestId: z.string(),
        createdAt: z.iso.datetime(),
        createdBy: z.string(),
      }),
    )
    .optional(),
});
