import type { StoreData } from '../../src/types';

export function createPilotFixture(concentrated = false): StoreData {
  const createdAt = '2026-08-01T00:00:00Z';
  const data: StoreData = {
    version: 1,
    store: { id: '22222222-2222-4222-8222-222222222222', name: 'Fictional performance notebook' },
    customers: Array.from({ length: 500 }, (_, index) => ({
      id: `pilot-customer-${index}`,
      name: `Fictional customer ${String(index + 1).padStart(3, '0')}`,
      contactNumber: '',
      identifyingNote: 'Generated performance fixture; no real debt or payment',
      createdAt,
    })),
    entries: [],
  };
  // Every pair adds ₱150 utang then pays ₱50; the notebook totals ₱1,000,000.
  // The concentrated variant gives customer 001 4,000 entries (₱200,000).
  for (let pair = 0; pair < 10_000; pair++) {
    const customerIndex = concentrated
      ? pair < 2_000
        ? 0
        : 1 + ((pair - 2_000) % 499)
      : pair % 500;
    const day = String(1 + (Math.floor(pair / 500) % 20)).padStart(2, '0');
    for (const type of ['utang', 'payment'] as const) {
      const id = `pilot-${pair}-${type}`;
      data.entries.push({
        id,
        requestId: id,
        customerId: data.customers[customerIndex].id,
        type,
        amountCentavos: type === 'utang' ? 15_000 : 5_000,
        description: `Fictional performance ${type} ${pair}`,
        effectiveDate: `2026-08-${day}`,
        effectiveTime: type === 'utang' ? '08:00:00' : '09:00:00',
        createdAt,
        status: 'active',
      });
    }
  }
  return data;
}
