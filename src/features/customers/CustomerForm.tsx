import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { repository, refreshData } from '../../app/data';
import { ErrorMessage, Field, Page } from '../../components/ui';
import { customerSchema } from '../../lib/validation';
import type { Customer, NewCustomer } from '../../types';

export function CustomerForm({
  onSaved,
  onCancel,
  inUtang = false,
}: {
  onSaved: (customer: Customer) => void;
  onCancel?: () => void;
  inUtang?: boolean;
}) {
  const requestId = useRef(crypto.randomUUID());
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NewCustomer>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: '', contactNumber: '', identifyingNote: '' },
  });
  return (
    <form
      className="stack"
      noValidate
      onSubmit={handleSubmit(async (values) => {
        try {
          const customer = await repository.createCustomer(values, requestId.current);
          await refreshData();
          onSaved(customer);
        } catch (error) {
          setError('root', {
            message: error instanceof Error ? error.message : 'Couldn’t save. Try again.',
          });
        }
      })}
    >
      <p className="muted small">A name is all you need to get started.</p>
      <Field label="Customer name" id="customer-name" error={errors.name?.message}>
        <input
          id="customer-name"
          autoComplete="name"
          placeholder="e.g. Rosa Garcia"
          aria-invalid={!!errors.name}
          {...register('name')}
        />
      </Field>
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
      <div className="note">
        <strong>New customers start at ₱0.00.</strong>
        <p className="small muted">You can add their first utang next.</p>
      </div>
      <ErrorMessage message={errors.root?.message} />
      <button className="button" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : inUtang ? 'Save customer & add utang' : 'Save customer'}
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
