import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { queryClient, readNotebook, repository, useData, useReadTotals } from '../../app/data';
import { Dialog, ErrorMessage, Field, Page, SummaryRow } from '../../components/ui';
import { CustomerForm } from '../customers/CustomerForm';
import { money, parseMoney } from '../../lib/money';
import { storeNow } from '../../lib/dates';
import { transactionSchema } from '../../lib/validation';
import { backendMode } from '../../lib/api/supabase';

type Values = z.infer<typeof transactionSchema>;
export function TransactionForm({
  payment = false,
  ownerId,
}: {
  payment?: boolean;
  ownerId: string;
}) {
  const data = useData();
  const totals = useReadTotals()!;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [addingCustomer, setAddingCustomer] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  const attemptedValues = useRef<string | null>(null);
  const savedEntryId = useRef<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const saving = useRef(false);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      customerId: params.get('customer') ?? '',
      amount: '',
      description: '',
      effectiveDate: storeNow().date,
    },
  });
  const customerId = watch('customerId');
  const current = totals.balances.find((b) => b.customerId === customerId)?.amount ?? 0;
  const amount = parseMoney(watch('amount'));
  const overpaid =
    payment && !retrying && !savedEntryId.current && amount !== null && amount > current;
  const customer = data.customers.find((c) => c.id === customerId);
  return (
    <Page
      title={payment ? 'Add Payment' : 'Add Utang'}
      back={params.get('customer') ? `/customers/${params.get('customer')}` : '/home'}
    >
      <p className="small muted">
        {payment
          ? 'Record money received from a customer.'
          : 'Add a purchase to your customer’s utang.'}
      </p>
      <form
        className="stack"
        noValidate
        onSubmit={handleSubmit(async (values) => {
          if (saving.current) return;
          const payload = JSON.stringify(values);
          const sameAttempt = attemptedValues.current === payload;
          if (attemptedValues.current && !sameAttempt) {
            setError('root', {
              message:
                'Keep the original details when retrying. Check the customer history before starting a different entry.',
            });
            return;
          }
          if (!sameAttempt && payment && parseMoney(values.amount)! > current) {
            setError('amount', { message: 'Payment is higher than the remaining balance.' });
            return;
          }
          saving.current = true;
          attemptedValues.current = payload;
          try {
            if (!savedEntryId.current) {
              const entry = await repository.recordEntry(
                {
                  customerId: values.customerId,
                  type: payment ? 'payment' : 'utang',
                  amountCentavos: parseMoney(values.amount)!,
                  description: values.description,
                  effectiveDate: values.effectiveDate,
                },
                requestId.current,
              );
              savedEntryId.current = entry.id;
            }
            await queryClient.invalidateQueries({ queryKey: ['store'] }, { throwOnError: true });
            // Keep the saved form and retry state until its complete confirmation
            // history is ready, even if an older history is already cached.
            const confirmationView = { kind: 'customer' as const, customerId: values.customerId };
            await queryClient.fetchQuery({
              queryKey: ['store', ownerId, confirmationView],
              queryFn: () => readNotebook(confirmationView),
            });
            navigate(
              `/transactions/${savedEntryId.current}/confirmation?customer=${encodeURIComponent(values.customerId)}`,
              { replace: true },
            );
          } catch (error) {
            // Validation/access failures roll back the RPC transaction. A lost
            // connection has an uncertain result, so preserve its exact attempt.
            const rejected =
              !savedEntryId.current &&
              (backendMode === 'local' ||
                (error instanceof Error &&
                  'code' in error &&
                  typeof error.code === 'string' &&
                  /^(P0001|42501|22...|23...)$/.test(error.code)));
            if (rejected) attemptedValues.current = null;
            setRetrying(!rejected);
            setError('root', {
              message: savedEntryId.current
                ? 'Your entry was saved, but the notebook could not refresh. Retry to load the confirmation; this will not save another entry.'
                : error instanceof Error
                  ? error.message
                  : 'Couldn’t save. Your details are still here—try again.',
            });
          } finally {
            saving.current = false;
          }
        })}
      >
        <Field label="Customer" id="customer" error={errors.customerId?.message}>
          <select
            id="customer"
            aria-invalid={!!errors.customerId}
            {...register('customerId')}
            value={customerId}
          >
            <option value="">Select a customer…</option>
            {data.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.contactNumber || c.identifyingNote
                  ? ` · ${c.contactNumber || c.identifyingNote}`
                  : ''}
              </option>
            ))}
          </select>
        </Field>
        {customer && (
          <div className={payment ? 'note' : 'card debt'}>
            <SummaryRow label="Current utang" value={money(current)} tone="utang" />
            {(customer.contactNumber || customer.identifyingNote) && (
              <p className="small muted">
                {[customer.contactNumber, customer.identifyingNote].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        )}
        {payment && customer && current === 0 && (
          <p className="note">
            This customer is fully paid.{' '}
            {retrying
              ? 'Retry checks whether your original payment was recorded.'
              : 'Add utang before recording another payment.'}
          </p>
        )}
        <Field
          label={payment ? 'Payment amount' : 'Amount'}
          id="amount"
          error={errors.amount?.message}
        >
          <div className="money-input">
            <span aria-hidden="true">₱</span>
            <input
              id="amount"
              inputMode="decimal"
              placeholder="0.00"
              autoComplete="off"
              aria-invalid={!!errors.amount || overpaid}
              {...register('amount')}
            />
          </div>
        </Field>
        {!payment && (
          <>
            <Field
              label="Item / description (optional)"
              id="description"
              error={errors.description?.message}
            >
              <textarea
                id="description"
                rows={2}
                placeholder="e.g. Rice & canned goods"
                {...register('description')}
              />
            </Field>
            <button type="button" className="button plain" onClick={() => setAddingCustomer(true)}>
              + Add a new customer
            </button>
          </>
        )}
        <Field label="Date" id="date" error={errors.effectiveDate?.message}>
          <input
            id="date"
            type="date"
            min="1900-01-01"
            max={storeNow().date}
            {...register('effectiveDate')}
          />
        </Field>
        {payment && customer && !retrying && !savedEntryId.current && (
          <div className="note" aria-live="polite">
            <SummaryRow label="Payment received" value={money(amount ?? 0)} tone="payment" />
            {overpaid ? (
              <p className="error">Payment is higher than the remaining balance.</p>
            ) : (
              <>
                <SummaryRow
                  label="Remaining utang"
                  value={money(current - (amount ?? 0))}
                  tone="utang"
                />
                <p className="small payment">
                  {amount === current ? 'Full payment' : 'Partial payment'} · balance updates on
                  save
                </p>
              </>
            )}
          </div>
        )}
        <ErrorMessage message={errors.root?.message} />
        <button
          className={`button ${payment ? '' : 'orange'}`}
          disabled={isSubmitting || (!retrying && payment && !!customer && current === 0)}
        >
          {isSubmitting
            ? 'Saving…'
            : retrying
              ? 'Retry save'
              : payment
                ? 'Record payment'
                : 'Save utang'}
        </button>
        {retrying && (
          <p className="small muted">
            Keep these details to retry the same save. Before leaving this form, check the customer
            history to avoid entering it twice.
          </p>
        )}
        <p className="small muted">
          {backendMode === 'local'
            ? 'Saved only in this browser’s demo notebook.'
            : 'Saves to your private store notebook. An internet connection is required.'}
        </p>
      </form>
      {addingCustomer && (
        <Dialog title="New Customer" onClose={() => setAddingCustomer(false)}>
          <CustomerForm
            inUtang
            onSaved={(c) => {
              setValue('customerId', c.id, { shouldValidate: true });
              setAddingCustomer(false);
            }}
            onCancel={() => setAddingCustomer(false)}
          />
        </Dialog>
      )}
    </Page>
  );
}
