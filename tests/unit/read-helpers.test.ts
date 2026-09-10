import { afterEach, expect, test, vi } from 'vitest';
import { dateLabel, storeNow } from '../../src/lib/dates';
import { money } from '../../src/lib/money';
import { dateSchema } from '../../src/lib/validation';
import { balancesByCustomer } from '../../src/lib/ledger';
import type { LedgerEntry } from '../../src/types';

afterEach(() => vi.useRealTimers());

test('reused date formatters still advance across Manila midnight', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-09T15:59:59Z'));
  expect(storeNow()).toEqual({ date: '2026-09-09', time: '23:59:59' });
  expect(dateSchema.safeParse('2026-09-10').success).toBe(false);
  vi.setSystemTime(new Date('2026-09-09T16:00:00Z'));
  expect(storeNow()).toEqual({ date: '2026-09-10', time: '00:00:00' });
  expect(dateSchema.safeParse('2026-09-10').success).toBe(true);
  expect(dateSchema.safeParse('2026-09-11').success).toBe(false);
  expect(dateSchema.safeParse('2026-02-30').success).toBe(false);
  vi.setSystemTime(new Date('2026-09-09T15:59:59.999Z'));
  expect(storeNow()).toEqual({ date: '2026-09-09', time: '23:59:59' });
  expect(dateSchema.safeParse('2026-09-10').success).toBe(false);
  const clock = storeNow();
  clock.date = '2000-01-01';
  clock.time = '00:00:00';
  expect(storeNow()).toEqual({ date: '2026-09-09', time: '23:59:59' });
  expect(storeNow(new Date('2026-09-09T15:59:58Z')).time).toBe('23:59:58');
});

test('date and peso labels retain their existing display format', () => {
  expect(dateLabel('2026-09-10')).toBe('Sep 10, 2026');
  expect(dateLabel('2026-09-10', true)).toBe('Thursday, September 10, 2026');
  expect(money(0)).toBe('₱0.00');
  expect(money(1)).toBe('₱0.01');
  expect(money(123456789)).toBe('₱1,234,567.89');
  expect(money(-15025)).toBe('₱-150.25');
});

test('customer totals include opening balances and replacements, excluding voided amounts', () => {
  const make = (
    customerId: string,
    type: LedgerEntry['type'],
    amountCentavos: number,
    status: LedgerEntry['status'] = 'active',
  ): LedgerEntry => ({
    id: `${customerId}-${type}-${amountCentavos}`,
    requestId: `${customerId}-${type}-${amountCentavos}`,
    customerId,
    type,
    amountCentavos,
    status,
    description: 'Fictional test',
    createdAt: '2026-08-01T00:00:00Z',
    effectiveDate: '2026-08-01',
    effectiveTime: '08:00:00',
  });
  const entries = [
    make('a', 'payment', 4000),
    make('b', 'utang', 6000),
    make('a', 'utang', 5000, 'voided'),
    make('a', 'opening_balance', 10000),
    make('b', 'payment', 6000),
    { ...make('a', 'utang', 15000), replacesEntryId: 'a-utang-5000' },
  ];
  expect([...balancesByCustomer(entries)]).toEqual([
    ['a', 21000],
    ['b', 0],
  ]);
  expect(balancesByCustomer(entries).get('empty')).toBeUndefined();
  expect(balancesByCustomer([...entries, make('a', 'payment', 1000)]).get('a')).toBe(20000);
});
