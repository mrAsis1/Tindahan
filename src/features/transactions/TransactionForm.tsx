import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { refreshData, repository, useData } from '../../app/data';
import { Dialog, ErrorMessage, Field, Page, SummaryRow } from '../../components/ui';
import { CustomerForm } from '../customers/CustomerForm';
import { balance } from '../../lib/ledger';
import { money, parseMoney } from '../../lib/money';
import { storeNow } from '../../lib/dates';
import { transactionSchema } from '../../lib/validation';
import { backendMode } from '../../lib/api/supabase';

type Values = z.infer<typeof transactionSchema>;
export function TransactionForm({ payment = false }: { payment?: boolean }) {
  const data = useData();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [addingCustomer, setAddingCustomer] = useState(false);
  const requestId = useRef(crypto.randomUUID());
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
  const current = balance(data.entries, customerId);
  const amount = parseMoney(watch('amount'));
  const overpaid = payment && amount !== null && amount > current;
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
          if (isSubmitting) return;
          if (payment && parseMoney(values.amount)! > current) {
            setError('amount', { message: 'Payment is higher than the remaining balance.' });
            return;
          }
          try {
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
            await refreshData();
            navigate(`/transactions/${entry.id}/confirmation`, { replace: true });
          } catch (error) {
            setError('root', {
              message:
                error instanceof Error
                  ? error.message
                  : 'Couldn’t save. Your details are still here—try again.',
            });
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
            This customer is fully paid. Add utang before recording another payment.
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
        {payment && customer && (
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
          disabled={isSubmitting || (payment && !!customer && current === 0)}
        >
          {isSubmitting ? 'Saving…' : payment ? 'Record payment' : 'Save utang'}
        </button>
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
