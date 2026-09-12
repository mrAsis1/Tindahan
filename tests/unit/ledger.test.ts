import { describe, expect, it, vi, afterEach } from 'vitest';
import { balance, dailySummary, history } from '../../src/lib/ledger';
import { parseMoney } from '../../src/lib/money';
import { storeNow, validDate } from '../../src/lib/dates';
import { createSeed } from '../../src/lib/api/seed';
import { createLocalRepository, STORAGE_KEY } from '../../src/lib/api/localRepository';
import type { NewEntry, StoreData } from '../../src/types';

function setup(initial?: StoreData) {
  const map = new Map<string, string>();
  if (initial) map.set(STORAGE_KEY, JSON.stringify(initial));
  const storage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
  return { repository: createLocalRepository(storage), map, storage };
}
const input = (overrides: Partial<NewEntry> = {}): NewEntry => ({
  customerId: 'customer-0',
  type: 'payment',
  amountCentavos: 20_000,
  description: '',
  effectiveDate: '2026-09-06',
  ...overrides,
});
afterEach(() => vi.useRealTimers());

describe('Money and store dates', () => {
  it.each([
    ['150.25', 15025],
    [' 0.01 ', 1],
    ['200', 20000],
    ['001.2', 120],
  ])('parses %s into exact centavos', (text, cents) => expect(parseMoney(text)).toBe(cents));
  it.each(['0', '-1', '1.001', '1e2', 'NaN', '', '1,000', '10000000', '.50', 'Infinity'])(
    'rejects invalid amount %s',
    (text) => expect(parseMoney(text)).toBeNull(),
  );
  it('uses Manila calendar dates across UTC midnight boundaries', () => {
    expect(storeNow(new Date('2026-09-05T16:01:00Z'))).toEqual({
      date: '2026-09-06',
      time: '00:01:00',
    });
    expect(validDate('2026-02-30')).toBe(false);
    expect(validDate('2028-02-29')).toBe(true);
  });
});

describe('Ledger and demo persistence', () => {
  it('reconciles reference data, daily totals and chronological running balances', () => {
    const seed = createSeed();
    expect(balance(seed.entries)).toBe(485000);
    expect(balance(seed.entries, 'customer-0')).toBe(85000);
    expect(history(seed.entries, 'customer-0').map((e) => e.runningBalance)).toEqual([
      85000, 70000, 100000, 0, 50000,
    ]);
    expect(dailySummary(seed.entries, '2026-09-05')).toMatchObject({
      utang: 65000,
      payments: 40000,
      closing: 485000,
    });
    expect(dailySummary(seed.entries, '2026-09-04').closing).toBe(460000);
    expect(dailySummary(seed.entries, '2026-09-06')).toMatchObject({
      utang: 0,
      payments: 0,
      closing: 485000,
    });
  });
  it('records a partial payment, persists it, and retries without duplicating it', async () => {
    const { repository, storage } = setup();
    const first = await repository.recordEntry(input(), 'request-a');
    expect(await repository.recordEntry(input(), 'request-a')).toEqual(first);
    const reloaded = await createLocalRepository(storage).getData();
    expect(reloaded.entries).toHaveLength(17);
    expect(balance(reloaded.entries, 'customer-0')).toBe(65000);
    await expect(
      repository.recordEntry(input({ amountCentavos: 100 }), 'request-a'),
    ).rejects.toThrow('different transaction');
  });
  it('adds utang and keeps similar and duplicate customer names distinct', async () => {
    const { repository } = setup();
    await repository.recordEntry(input({ type: 'utang', amountCentavos: 15000 }), 'utang-1');
    expect(balance((await repository.getData()).entries, 'customer-0')).toBe(100000);
    const values = { name: ' Maria Santos ', contactNumber: '', identifyingNote: 'Near bakery' };
    const customer = await repository.createCustomer(values, 'new-id');
    expect(customer.name).toBe('Maria Santos');
    expect(await repository.createCustomer(values, 'new-id')).toEqual(customer);
    await repository.createCustomer({ ...values, name: 'Maria Santosa' }, 'similar-id');
    expect((await repository.getData()).customers).toHaveLength(8);
    expect(balance((await repository.getData()).entries, customer.id)).toBe(0);
  });
  it('accepts a full payment and rejects overpayments without mutating saved data', async () => {
    const { repository, map } = setup();
    await repository.recordEntry(input({ amountCentavos: 85000 }), 'full');
    const saved = map.get(STORAGE_KEY);
    await expect(repository.recordEntry(input({ amountCentavos: 1 }), 'too-much')).rejects.toThrow(
      'available balance',
    );
    expect(map.get(STORAGE_KEY)).toBe(saved);
    expect(balance((await repository.getData()).entries, 'customer-0')).toBe(0);
  });
  it('rejects a backdated payment that makes a later historical balance negative', async () => {
    const { repository } = setup();
    await expect(
      repository.recordEntry(input({ effectiveDate: '2026-08-26', amountCentavos: 10000 }), 'past'),
    ).rejects.toThrow('available balance');
    await expect(
      repository.recordEntry(
        input({ effectiveDate: '2026-08-24', amountCentavos: 100 }),
        'before-first',
      ),
    ).rejects.toThrow('available balance');
    expect((await repository.getData()).entries).toHaveLength(16);
  });
  it('recalculates historical balances after a valid backdated entry', async () => {
    const { repository } = setup();
    await repository.recordEntry(
      input({ type: 'utang', effectiveDate: '2026-08-26', amountCentavos: 1000 }),
      'past-utang',
    );
    const data = await repository.getData();
    expect(history(data.entries, 'customer-0')[0].runningBalance).toBe(86000);
    expect(dailySummary(data.entries, '2026-08-28').closing).toBe(1000);
  });
  it('rejects future dates, unknown customers, fractional cents and blank customer names', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-06T04:00:00Z'));
    const { repository } = setup();
    await expect(
      repository.recordEntry(input({ effectiveDate: '2026-09-07' }), 'future'),
    ).rejects.toThrow();
    await expect(
      repository.recordEntry(input({ customerId: 'missing' }), 'missing'),
    ).rejects.toThrow();
    await expect(
      repository.recordEntry(input({ amountCentavos: 1.5 }), 'fraction'),
    ).rejects.toThrow();
    await expect(
      repository.createCustomer({ name: ' ', contactNumber: '', identifyingNote: '' }, 'blank'),
    ).rejects.toThrow();
  });
  it('separates opening balances from new utang in daily summaries', async () => {
    const { repository } = setup({
      version: 1,
      customers: [createSeed().customers[0]],
      entries: [],
    });
    await repository.recordEntry(
      input({ type: 'opening_balance', amountCentavos: 50000 }),
      'opening',
    );
    expect(dailySummary((await repository.getData()).entries, '2026-09-06')).toMatchObject({
      opening: 50000,
      utang: 0,
      payments: 0,
      closing: 50000,
    });
  });
  it('uses deterministic ID tie-breaks for entries sharing timestamps', () => {
    const base = createSeed().entries[0];
    const entries = [
      { ...base, id: 'b', amountCentavos: 200 },
      { ...base, id: 'a', amountCentavos: 100 },
    ];
    expect(history(entries, 'customer-0').map((e) => [e.id, e.runningBalance])).toEqual([
      ['b', 300],
      ['a', 100],
    ]);
  });
  it('does not report success or lose the old ledger when storage fails', async () => {
    const { repository, storage } = setup(createSeed());
    storage.setItem = () => {
      throw new Error('quota');
    };
    await expect(repository.recordEntry(input(), 'failure')).rejects.toThrow('Couldn’t save');
    expect((await repository.getData()).entries).toHaveLength(16);
  });
  it('preserves corrupt data until the user explicitly resets it', async () => {
    const { repository, map } = setup();
    map.set(STORAGE_KEY, '{broken');
    await expect(repository.getData()).rejects.toThrow('kept unchanged');
    expect(map.get(STORAGE_KEY)).toBe('{broken');
    await repository.reset(true);
    expect(await repository.getData()).toEqual({ version: 1, customers: [], entries: [] });
  });
});

it('rejects duplicate customer details without modifying storage and preserves retries', async () => {
  const { repository, storage } = setup({ version: 1, customers: [], entries: [] });
  const values = { name: 'Fictional One', contactNumber: '', identifyingNote: 'Near bakery' };
  const first = await repository.createCustomer(values, 'first');
  const before = storage.getItem(STORAGE_KEY);
  await expect(
    repository.createCustomer(
      { ...values, name: '  fictional   ONE ', identifyingNote: 'near BAKERY' },
      'second',
    ),
  ).rejects.toThrow('already exists');
  expect(storage.getItem(STORAGE_KEY)).toBe(before);
  expect(await repository.createCustomer(values, 'first')).toEqual(first);
  await repository.createCustomer({ ...values, identifyingNote: 'Near school' }, 'different');
  expect((await repository.getData()).customers).toHaveLength(2);
});
