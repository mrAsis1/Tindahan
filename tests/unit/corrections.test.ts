import { describe, expect, it } from 'vitest';
import { createLocalRepository } from '../../src/lib/api/localRepository';
import { balance, dailySummary, history } from '../../src/lib/ledger';
import type { StoreData, CorrectionInput } from '../../src/types';

function setup() {
  const initial: StoreData = {
    version: 1,
    customers: [
      {
        id: 'c',
        name: 'Fictional Customer',
        contactNumber: '',
        identifyingNote: '',
        createdAt: '2026-09-01T00:00:00Z',
      },
    ],
    entries: [
      {
        id: 'utang',
        requestId: 'utang',
        customerId: 'c',
        type: 'utang',
        amountCentavos: 15000,
        effectiveDate: '2026-09-01',
        effectiveTime: '08:00:00',
        createdAt: '2026-09-01T00:00:00.001Z',
        description: 'Rice',
      },
      {
        id: 'payment',
        requestId: 'payment',
        customerId: 'c',
        type: 'payment',
        amountCentavos: 5000,
        effectiveDate: '2026-09-01',
        effectiveTime: '08:00:00',
        createdAt: '2026-09-01T00:00:00.002Z',
        description: '',
      },
    ],
  };
  let raw = JSON.stringify(initial);
  const storage = {
    getItem: () => raw,
    setItem: (_key: string, value: string) => {
      raw = value;
    },
  };
  return { repository: createLocalRepository(storage), storage };
}
const replace: CorrectionInput = {
  entryId: 'utang',
  reason: 'Wrong amount',
  replacement: {
    amountCentavos: 12000,
    description: 'Rice corrected',
    effectiveDate: '2026-09-01',
  },
};

describe('Local correction parity and compatibility', () => {
  it('reads old notebooks, preserves originals and same-second order, recalculates all totals', async () => {
    const { repository, storage } = setup();
    expect(balance((await repository.getData()).entries)).toBe(10000);
    await repository.correctEntry(replace, 'correction');
    const data = await createLocalRepository(storage).getData();
    expect(data.entries.find((e) => e.id === 'utang')).toMatchObject({
      amountCentavos: 15000,
      status: 'voided',
      voidReason: 'Wrong amount',
      voidedBy: 'local-demo',
    });
    expect(data.corrections).toHaveLength(1);
    expect(balance(data.entries)).toBe(7000);
    expect(history(data.entries, 'c')[0].runningBalance).toBe(7000);
    expect(dailySummary(data.entries, '2026-09-01')).toMatchObject({
      utang: 12000,
      payments: 5000,
      closing: 7000,
    });
  });
  it('retries once, rejects conflicting requests and prevents double correction', async () => {
    const { repository } = setup();
    await repository.correctEntry(replace, 'correction');
    await repository.correctEntry(replace, 'correction');
    expect((await repository.getData()).entries).toHaveLength(3);
    await expect(
      repository.correctEntry({ ...replace, reason: 'Different' }, 'correction'),
    ).rejects.toThrow('different correction');
    await expect(repository.correctEntry(replace, 'another')).rejects.toThrow(
      'already been voided',
    );
    await expect(
      repository.recordEntry(
        {
          customerId: 'c',
          type: 'utang',
          amountCentavos: 1,
          description: '',
          effectiveDate: '2026-09-01',
        },
        'correction',
      ),
    ).rejects.toThrow('used for a correction');
  });
  it('rolls back historical-negative changes and storage failures without partial voids', async () => {
    const { repository, storage } = setup();
    const before = storage.getItem();
    await expect(
      repository.correctEntry({ ...replace, replacement: null }, 'correction'),
    ).rejects.toThrow('available balance');
    await expect(
      repository.correctEntry(
        { ...replace, replacement: { ...replace.replacement!, effectiveDate: '2026-09-02' } },
        'correction',
      ),
    ).rejects.toThrow('available balance');
    expect(storage.getItem()).toBe(before);
    const failing = createLocalRepository({
      getItem: storage.getItem,
      setItem: () => {
        throw new Error('Disk full');
      },
    });
    await expect(failing.correctEntry(replace, 'correction')).rejects.toThrow('Couldn’t save');
    expect(storage.getItem()).toBe(before);
  });
  it('voids a payment and corrects a replacement with its original ordering identity', async () => {
    const { repository } = setup();
    await repository.correctEntry(replace, 'first');
    await repository.correctEntry({ ...replace, entryId: 'first' }, 'second');
    await repository.correctEntry(
      { entryId: 'payment', reason: 'Duplicate payment', replacement: null },
      'void',
    );
    const data = await repository.getData();
    expect(balance(data.entries)).toBe(12000);
    expect(data.entries.find((e) => e.id === 'second')).toMatchObject({
      replacesEntryId: 'first',
      orderId: 'utang',
    });
    expect(data.corrections).toHaveLength(3);
  });
});
