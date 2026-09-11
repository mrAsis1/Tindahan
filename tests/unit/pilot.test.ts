import { expect, test } from 'vitest';
import { assertLedger, balance, dailySummary, history } from '../../src/lib/ledger';
import { storeSchema } from '../../src/lib/validation';
import { createPilotFixture } from '../fixtures/pilot';

test.each([false, true])(
  'pilot fixture reconciles (concentrated: %s)',
  (concentrated) => {
    const data = storeSchema.parse(createPilotFixture(concentrated));
    expect(data.customers).toHaveLength(500);
    expect(data.entries).toHaveLength(20_000);
    expect(() => assertLedger(data)).not.toThrow();
    expect(balance(data.entries)).toBe(100_000_000);
    expect(history(data.entries, 'pilot-customer-0')).toHaveLength(concentrated ? 4_000 : 40);
    expect(balance(data.entries, 'pilot-customer-0')).toBe(concentrated ? 20_000_000 : 200_000);
    expect(dailySummary(data.entries, '2026-08-20')).toMatchObject({
      utang: 7_500_000,
      payments: 2_500_000,
      closing: 100_000_000,
    });
  },
  30_000,
);
