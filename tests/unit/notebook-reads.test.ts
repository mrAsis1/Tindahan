import { expect, test } from 'vitest';
import { projectNotebook, viewForRoute } from '../../src/lib/notebookReads';
import { createPilotFixture } from '../fixtures/pilot';

test('scope routing keeps write and correction forms on the complete ledger', () => {
  for (const path of [
    '/utang/new',
    '/payments/new',
    '/customers/new',
    '/CUSTOMERS/NEW/',
    '/transactions/id/correct',
    '/transactions/id/confirmation',
  ])
    expect(viewForRoute(path, '?customer=another')).toEqual({ kind: 'full' });
  expect(viewForRoute('/HOME/', '').kind).toBe('home');
  expect(viewForRoute('/h%6fme', '').kind).toBe('home');
  expect(viewForRoute('/Search/', '')).toEqual({ kind: 'directory' });
  expect(viewForRoute('/customers/Fictional%20One/', '')).toEqual({
    kind: 'customer',
    customerId: 'Fictional One',
  });
  expect(viewForRoute('/daily-record', '?date=2026-08-20')).toEqual({
    kind: 'day',
    day: '2026-08-20',
  });
  expect(viewForRoute('/daily-record', '?date=2999-01-01')).toEqual({
    kind: 'day',
    day: (viewForRoute('/home', '') as { day: string }).day,
  });
});

test('scoped local reads never overwrite or truncate the stored notebook', () => {
  const data = createPilotFixture(true);
  const before = JSON.stringify(data);
  const home = projectNotebook(data, { kind: 'home', day: '2026-08-20' });
  expect(home.notebook.entries).toHaveLength(3);
  expect(home.totals).toMatchObject({
    outstanding: 100000000,
    withBalance: 500,
    utang: 7500000,
    payments: 2500000,
  });
  const directory = projectNotebook(data, { kind: 'directory' });
  expect(directory.notebook.entries).toHaveLength(0);
  expect(directory.notebook.customers).toHaveLength(500);
  expect(directory.totals?.balances[0].amount).toBe(20000000);
  const customer = projectNotebook(data, { kind: 'customer', customerId: 'pilot-customer-0' });
  expect(customer.notebook.entries).toHaveLength(4000);
  expect(customer.notebook.customers).toHaveLength(1);
  expect(projectNotebook(data, { kind: 'day', day: '2026-08-20' }).notebook.entries).toHaveLength(
    1000,
  );
  expect(projectNotebook(data, { kind: 'full' }).notebook).toBe(data);
  expect(JSON.stringify(data)).toBe(before);
});
