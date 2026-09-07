import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { correctionSchema, customerSchema, newEntrySchema, storeSchema } from '../validation';
import type { Repository } from './repository';
import { recoveryLocation } from '../../features/auth/recoveryHelpers';

export const initialRecovery =
  typeof window === 'undefined'
    ? { requested: false, hasError: false }
    : recoveryLocation(window.location.href);

export const backendMode = import.meta.env.VITE_DATA_BACKEND ?? 'local';
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const configurationError = !['local', 'supabase'].includes(backendMode)
  ? 'VITE_DATA_BACKEND must be local or supabase.'
  : backendMode === 'supabase' &&
      (!url ||
        !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) ||
        !key?.startsWith('sb_publishable_'))
    ? 'Add your Supabase project URL and publishable key to .env.local, then restart the app. See docs/supabase-setup.md.'
    : null;

export const supabase =
  backendMode === 'supabase' && !configurationError
    ? createClient(url!, key!, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;

const snapshotSchema = storeSchema.extend({
  store: z.object({ id: z.uuid(), name: z.string() }).nullable(),
});
const customerResult = customerSchema.extend({ id: z.uuid(), createdAt: z.iso.datetime() });
const entryResult = storeSchema.shape.entries.element;

function client() {
  if (!supabase) throw new Error(configurationError ?? 'Supabase mode is not enabled.');
  return supabase;
}

function rpcError(message: string, code?: string) {
  if (code === 'PGRST202')
    return new Error(
      'The database setup has not been applied yet. Run the Tindahan migration in Supabase, then try again.',
    );
  return new Error(message);
}

export const supabaseRepository: Repository = {
  async correctEntry(input, requestId) {
    const values = correctionSchema.parse(input);
    const { error } = await client().rpc('correct_entry', {
      p_request_id: requestId,
      p_entry_id: values.entryId,
      p_reason: values.reason,
      p_replacement: values.replacement,
    });
    if (error) throw rpcError(error.message, error.code);
  },
  async getData() {
    const { data, error } = await client().rpc('get_notebook');
    if (error) throw rpcError(error.message, error.code);
    return snapshotSchema.parse(data);
  },
  async createCustomer(input, requestId) {
    const values = customerSchema.parse(input);
    const { data, error } = await client().rpc('create_customer', {
      p_request_id: requestId,
      p_name: values.name,
      p_contact_number: values.contactNumber,
      p_identifying_note: values.identifyingNote,
    });
    if (error) throw rpcError(error.message, error.code);
    return customerResult.parse(data);
  },
  async recordEntry(input, requestId) {
    const values = newEntrySchema.parse(input);
    const { data, error } = await client().rpc('record_entry', {
      p_request_id: requestId,
      p_customer_id: values.customerId,
      p_type: values.type,
      p_amount_centavos: values.amountCentavos,
      p_effective_date: values.effectiveDate,
      p_description: values.description,
    });
    if (error) throw rpcError(error.message, error.code);
    return entryResult.parse(data);
  },
};

export async function createStore(name: string) {
  const { error } = await client().rpc('create_store', { p_name: name.trim() });
  if (error) throw rpcError(error.message, error.code);
}
