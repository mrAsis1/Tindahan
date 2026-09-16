import { useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { repository, queryClient, refreshData, useData } from '../../app/data';
import { backendMode } from '../../lib/api/supabase';
import { ErrorMessage, Field, Page } from '../../components/ui';
import { customerSchema } from '../../lib/validation';
import type { Customer, NewCustomer } from '../../types';
import { customerText, sameCustomer, duplicateCustomerMessage } from '../../lib/customerIdentity';

export function CustomerForm({
  onSaved,
  onCancel,
  inUtang = false,
  customer: editing,
  initialName = '',
}: {
  onSaved: (customer: Customer) => void;
  onCancel?: () => void;
  inUtang?: boolean;
  customer?: Customer;
  initialName?: string;
}) {
  const requestId = useRef(crypto.randomUUID());
  const original = useRef(editing).current;
  const attempted = useRef<string | null>(null);
  const saved = useRef(false);
  const { customers } = useData();
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<NewCustomer>({
    resolver: zodResolver(customerSchema),
    defaultValues: original ?? { name: initialName, contactNumber: '', identifyingNote: '' },
  });
  const name = watch('name');
  const matches = customers.filter(
    (c) => c.id !== original?.id && customerText(c.name) === customerText(name),
  );
  return (
    <form
      className="stack"
      noValidate
      onSubmit={handleSubmit(async (values) => {
        try {
          if (original) {
            const payload = JSON.stringify(values);
            if (attempted.current && attempted.current !== payload)
              throw new Error(
                'Keep the original details when retrying. Check customer history before starting a different change.',
              );
            attempted.current = payload;
            if (!saved.current) {
              await repository.changeCustomer(
                {
                  customerId: original.id,
                  expectedRevision: original.revision ?? 0,
                  details: values,
                  deleted: original.deleted ?? false,
                },
                requestId.current,
              );
              saved.current = true;
            }
            await queryClient.invalidateQueries({ queryKey: ['store'] }, { throwOnError: true });
            onSaved({ ...original, ...values });
            return;
          }
          if (customers.some((c) => c.id !== requestId.current && sameCustomer(c, values))) {
            setError('name', { message: duplicateCustomerMessage });
            return;
          }
          const customer = await repository.createCustomer(values, requestId.current);
          await refreshData();
          onSaved(customer);
        } catch (error) {
          if (
            !saved.current &&
            (backendMode === 'local' ||
              (error instanceof Error &&
                'code' in error &&
                typeof error.code === 'string' &&
                /^(P0001|42501|22...|23...)$/.test(error.code)))
          )
            attempted.current = null;
          setError('root', {
            message: saved.current
              ? 'Changes saved, but the notebook could not refresh. Retry with the same details to refresh.'
              : error instanceof Error
                ? error.message
                : 'Couldn’t save. Try again.',
          });
        }
      })}
    >
      <p className="muted small">
        {original
          ? 'Changes keep the same customer, balance and transaction history.'
          : 'A name is all you need to get started.'}
      </p>
      <Field label="Customer name" id="customer-name" error={errors.name?.message}>
        <input
          id="customer-name"
          autoComplete="name"
          placeholder="e.g. Rosa Garcia"
          aria-invalid={!!errors.name}
          {...register('name')}
        />
      </Field>
      {matches.length > 0 && (
        <div className="note" aria-live="polite">
          <strong>Customers with this name already exist.</strong>
          <p className="small">
            {original
              ? 'Use a distinct contact number or identifying note to distinguish this person.'
              : 'Select the right person below. For a different person, add a distinct contact number or identifying note.'}
          </p>
          {!original &&
            matches.map((customer) =>
              customer.deleted ? (
                <Link className="button plain" key={customer.id} to={`/customers/${customer.id}`}>
                  View deleted customer: {customer.name}
                </Link>
              ) : (
                <button
                  className="button plain"
                  type="button"
                  key={customer.id}
                  disabled={isSubmitting}
                  onClick={() => onSaved(customer)}
                >
                  {customer.name}
                  {customer.contactNumber || customer.identifyingNote
                    ? ` · ${[customer.contactNumber, customer.identifyingNote].filter(Boolean).join(' · ')}`
                    : ''}
                </button>
              ),
            )}
        </div>
      )}
      <Field label="Contact number (optional)" id="contact" error={errors.contactNumber?.message}>
        <input
          id="contact"
          type="tel"
          autoComplete="tel"
          placeholder="09xx xxx xxxx"
          {...register('contactNumber')}
        />
      </Field>
      <Field
        label="Identifying note (optional)"
        id="identifying-note"
        error={errors.identifyingNote?.message}
      >
        <input
          id="identifying-note"
          placeholder="e.g. Near the bakery"
          {...register('identifyingNote')}
        />
      </Field>
      {!original && (
        <div className="note">
          <strong>New customers start at ₱0.00.</strong>
          <p className="small muted">You can add their first utang next.</p>
        </div>
      )}
      <ErrorMessage message={errors.root?.message} />
      <button className="button" disabled={isSubmitting}>
        {isSubmitting
          ? 'Saving…'
          : original
            ? 'Save changes'
            : inUtang
              ? 'Save customer & add utang'
              : 'Save customer'}
      </button>
      {onCancel && (
        <button className="button plain" type="button" disabled={isSubmitting} onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  );
}

export function NewCustomerPage() {
  const navigate = useNavigate();
  return (
    <Page title="New Customer" back="/customers">
      <CustomerForm
        onSaved={(customer) => navigate(`/customers/${customer.id}`, { replace: true })}
        onCancel={() => navigate('/customers')}
      />
    </Page>
  );
}

export function EditCustomerPage() {
  const { id } = useParams();
  const { customers } = useData();
  const customer = customers.find((c) => c.id === id);
  const navigate = useNavigate();
  return (
    <Page title="Edit customer" back={`/customers/${id}`}>
      {customer ? (
        <CustomerForm
          key={customer.id}
          customer={customer}
          onSaved={() => navigate(`/customers/${id}`, { replace: true })}
          onCancel={() => navigate(`/customers/${id}`)}
        />
      ) : (
        <p>Customer not found in your store.</p>
      )}
    </Page>
  );
}
