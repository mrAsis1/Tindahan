import { projectNotebook, type NotebookView } from '../../src/lib/notebookReads';
import type { StoreData } from '../../src/types';

export function fixtureView(input: Record<string, unknown>): NotebookView {
  if (input.p_view === 'directory') return { kind: 'directory' };
  if ((input.p_view === 'home' || input.p_view === 'day') && typeof input.p_day === 'string')
    return { kind: input.p_view, day: input.p_day };
  if (input.p_view === 'customer' && typeof input.p_customer_id === 'string')
    return { kind: 'customer', customerId: input.p_customer_id };
  throw new Error('Unexpected scoped fixture read');
}
export const fixtureRead = (data: StoreData, input: Record<string, unknown>) =>
  projectNotebook(data, fixtureView(input));
