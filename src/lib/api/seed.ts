import type { StoreData, LedgerEntry } from '../../types';

// Fixed reference dates deliberately match the original fictional prototype.
export function createSeed(): StoreData {
  const names = [
    'Maria Santos',
    'Ana Reyes',
    'Carlo Dela Cruz',
    'Liza Ramos',
    'Nestor Lim',
    'Ben Cruz',
  ];
  const rows: [number, number, string, string, string][] = [
    [0, 500, '2026-08-25', '10:00', 'Groceries'],
    [0, -500, '2026-08-28', '09:00', 'Full payment'],
    [0, 1000, '2026-09-01', '08:00', 'Rice, oil & groceries'],
    [0, -300, '2026-09-03', '11:00', 'Partial payment'],
    [1, 900, '2026-09-01', '10:00', 'Groceries'],
    [2, 1200, '2026-09-01', '12:00', 'Groceries'],
    [3, 600, '2026-09-01', '12:30', 'Groceries'],
    [4, 500, '2026-09-01', '13:00', 'Groceries'],
    [5, 500, '2026-09-01', '14:00', 'Groceries'],
    [5, -300, '2026-09-04', '11:00', 'Partial payment'],
    [1, 500, '2026-09-04', '16:00', 'Groceries'],
    [3, 200, '2026-09-05', '08:00', 'Milk & bread'],
    [2, 300, '2026-09-05', '08:30', 'Rice & cooking oil'],
    [5, -200, '2026-09-05', '09:15', 'Full payment'],
    [1, -200, '2026-09-05', '09:45', 'Partial payment'],
    [0, 150, '2026-09-05', '10:30', 'Rice & canned goods'],
  ];
  return {
    version: 1,
    customers: names.map((name, i) => ({
      id: `customer-${i}`,
      name,
      contactNumber: i === 0 ? '0917 555 0132' : '',
      identifyingNote: '',
      createdAt: '2026-08-25T00:00:00Z',
    })),
    entries: rows.map(([c, amount, date, time, description], i): LedgerEntry => ({
      id: `seed-${i}`,
      requestId: `seed-request-${i}`,
      customerId: `customer-${c}`,
      type: amount < 0 ? 'payment' : 'utang',
      amountCentavos: Math.abs(amount) * 100,
      description,
      effectiveDate: date,
      effectiveTime: `${time}:00`,
      createdAt: `${date}T${time}:00Z`,
    })),
  };
}
