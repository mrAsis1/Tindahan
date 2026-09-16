import { expect, test } from 'vitest';
import { createLocalRepository } from '../../src/lib/api/localRepository';
import { balance } from '../../src/lib/ledger';

test('editing a customer preserves the ledger and records the old and new details once', async () => {
  let raw = JSON.stringify({ version: 1, customers: [], entries: [] });
  const storage = {
    getItem: () => raw,
    setItem: (_key: string, value: string) => {
      raw = value;
    },
  };
  const repository = createLocalRepository(storage);
  const details = { name: 'Maria Sants', contactNumber: '', identifyingNote: '' };
  await repository.createCustomer(details, 'customer');
  await repository.recordEntry(
    {
      customerId: 'customer',
      type: 'utang',
      amountCentavos: 15000,
      description: 'Rice',
      effectiveDate: '2026-09-01',
    },
    'entry',
  );
  const input = {
    customerId: 'customer',
    expectedRevision: 0,
    details: { ...details, name: 'Maria Santos' },
    deleted: false,
  };
  await repository.changeCustomer(input, 'edit');
  await repository.changeCustomer(input, 'edit');
  const data = await createLocalRepository(storage).getData();
  expect(data.customers[0]).toMatchObject({ name: 'Maria Santos', revision: 1, deleted: false });
  expect(data.customers[0].changes).toHaveLength(1);
  expect(data.customers[0].changes?.[0]).toMatchObject({
    requestId: 'edit',
    before: { ...details, deleted: false },
    after: { ...details, name: 'Maria Santos', deleted: false },
    createdBy: 'local-demo',
    createdAt: expect.any(String),
  });
  expect(balance(data.entries)).toBe(15000);
  expect(data.entries).toHaveLength(1);
});

test('deleted customers retain balances and history, reject new entries, and can be restored', async () => {
  let raw = JSON.stringify({ version: 1, customers: [], entries: [] });
  const repository = createLocalRepository({
    getItem: () => raw,
    setItem: (_key, value) => {
      raw = value;
    },
  });
  const details = { name: 'Maria Santos', contactNumber: '', identifyingNote: '' };
  await repository.createCustomer(details, 'customer');
  const entry = {
    customerId: 'customer',
    type: 'utang' as const,
    amountCentavos: 15000,
    description: '',
    effectiveDate: '2026-09-01',
  };
  await repository.recordEntry(entry, 'entry');
  await repository.changeCustomer(
    { customerId: 'customer', expectedRevision: 0, details, deleted: true },
    'delete',
  );
  await expect(repository.recordEntry(entry, 'new-entry')).rejects.toThrow('Restore');
  await repository.recordEntry(entry, 'entry');
  const deleted = await repository.getData();
  expect(deleted.customers[0].deleted).toBe(true);
  expect(balance(deleted.entries)).toBe(15000);
  await repository.changeCustomer(
    { customerId: 'customer', expectedRevision: 1, details, deleted: false },
    'restore',
  );
  expect((await repository.getData()).customers[0].changes?.map((c) => c.after.deleted)).toEqual([
    true,
    false,
  ]);
  await repository.recordEntry(entry, 'new-entry');
  expect(balance((await repository.getData()).entries)).toBe(30000);
});

test('customer changes cannot reuse transaction IDs or overwrite stale forms, and failed storage writes keep the original', async () => {
  let raw = JSON.stringify({ version: 1, customers: [], entries: [] });
  const storage = {
    getItem: () => raw,
    setItem: (_key: string, value: string) => {
      raw = value;
    },
  };
  const repository = createLocalRepository(storage);
  const details = { name: 'Maria Santos', contactNumber: '', identifyingNote: '' };
  await repository.createCustomer(details, 'customer');
  const input = { customerId: 'customer', expectedRevision: 0, details, deleted: true };
  await expect(repository.changeCustomer(input, 'customer')).rejects.toThrow('save ID');
  await expect(
    repository.changeCustomer({ ...input, details: { ...details, name: '' } }, 'empty'),
  ).rejects.toThrow();
  const before = raw;
  const failing = createLocalRepository({
    getItem: storage.getItem,
    setItem: () => {
      throw new Error('Disk full');
    },
  });
  await expect(failing.changeCustomer(input, 'delete')).rejects.toThrow('Couldn’t save');
  expect(raw).toBe(before);
  await repository.changeCustomer(input, 'delete');
  await expect(repository.changeCustomer({ ...input, deleted: false }, 'stale')).rejects.toThrow(
    'changed since',
  );
  await expect(repository.changeCustomer({ ...input, deleted: false }, 'delete')).rejects.toThrow(
    'different customer changes',
  );
  await expect(
    repository.recordEntry(
      {
        customerId: 'customer',
        type: 'utang',
        amountCentavos: 100,
        description: '',
        effectiveDate: '2026-09-01',
      },
      'delete',
    ),
  ).rejects.toThrow('save ID');
  expect((await repository.getData()).customers[0].changes).toHaveLength(1);
});

test('old duplicate customers can be flagged and restored without allowing a new duplicate edit', async () => {
  const details = { name: 'Maria Santos', contactNumber: '', identifyingNote: '' };
  let raw = JSON.stringify({
    version: 1,
    customers: ['one', 'two'].map((id) => ({ ...details, id, createdAt: '2026-09-01T00:00:00Z' })),
    entries: [],
  });
  const repository = createLocalRepository({
    getItem: () => raw,
    setItem: (_key, value) => {
      raw = value;
    },
  });
  await repository.changeCustomer(
    { customerId: 'one', expectedRevision: 0, details, deleted: true },
    'delete',
  );
  await repository.changeCustomer(
    { customerId: 'one', expectedRevision: 1, details, deleted: false },
    'restore',
  );
  await repository.createCustomer({ ...details, name: 'Other customer' }, 'other');
  await expect(
    repository.changeCustomer(
      { customerId: 'other', expectedRevision: 0, details, deleted: false },
      'duplicate',
    ),
  ).rejects.toThrow('already exists');
  expect((await repository.getData()).customers[0].changes).toHaveLength(2);
});
