import { useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { queryClient, repository, useData, useReadTotals } from '../../app/data';
import {
  CustomerRow,
  Dialog,
  Empty,
  EntryRow,
  ErrorMessage,
  Field,
  Page,
} from '../../components/ui';
import { PaginatedList } from '../../components/PaginatedList';
import { balance, history } from '../../lib/ledger';
import { money } from '../../lib/money';
import { dateLabel, storeNow, timeLabel } from '../../lib/dates';
import type { Customer } from '../../types';

export function Customers({ search = false }: { search?: boolean }) {
  const { customers } = useData();
  const totals = useReadTotals()!;
  const [query, setQuery] = useState('');
  const [deleted, setDeleted] = useState(false);
  const balances = useMemo(
    () => new Map(totals.balances.map((b) => [b.customerId, b.amount])),
    [totals],
  );
  const searchTerm = query.trim().toLocaleLowerCase();
  const matches = customers.filter(
    (c) => !!c.deleted === deleted && c.name.toLocaleLowerCase().includes(searchTerm),
  );
  return (
    <Page title={search ? 'Search' : 'Customers'}>
      {!search && (
        <Link className="button plain" to="/customers/new">
          + Add customer
        </Link>
      )}
      <p className="muted small">Find a customer and their balance.</p>
      <div className="chips" aria-label="Customer status">
        <button aria-pressed={!deleted} onClick={() => setDeleted(false)}>
          Active
        </button>
        <button aria-pressed={deleted} onClick={() => setDeleted(true)}>
          Deleted
        </button>
      </div>
      {deleted && (
        <p className="small muted">
          Deleted customers keep their balances and history. Open a customer to restore them.
        </p>
      )}
      <Field label="Search by name" id="search">
        <input
          id="search"
          type="search"
          placeholder="Type a customer name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </Field>
      <h2 aria-live="polite">
        {matches.length} {matches.length === 1 ? 'customer' : 'customers'}
        {!search && ` · ${matches.filter((c) => (balances.get(c.id) ?? 0) > 0).length} with utang`}
      </h2>
      {!!matches.length && (
        <div className="card record-list">
          <PaginatedList
            key={`${deleted}:${searchTerm}`}
            items={matches}
            label="Customers"
            renderItem={(customer) => (
              <CustomerRow
                key={customer.id}
                customer={customer}
                balance={balances.get(customer.id) ?? 0}
              />
            )}
          />
        </div>
      )}
      {!matches.length && (
        <Empty>
          {deleted
            ? 'No deleted customers found.'
            : customers.length
              ? 'No customers found. Try another name.'
              : 'Your customer notebook is empty.'}
          <Link className="button plain" to="/customers/new">
            + Add customer
          </Link>
        </Empty>
      )}
    </Page>
  );
}

export function CustomerDetail() {
  const [params] = useSearchParams();
  const { id } = useParams();
  const { customers, entries } = useData();
  const [filter, setFilter] = useState('all');
  const [changingStatus, setChangingStatus] = useState(false);
  const allHistory = useMemo(() => history(entries, id ?? ''), [entries, id]);
  const customer = customers.find((c) => c.id === id);
  if (!customer)
    return (
      <Page title="Customer not found" back="/customers">
        <Empty>This customer is not in your store.</Empty>
      </Page>
    );
  const current = balance(entries, customer.id);
  const rows = allHistory.filter((e) => filter === 'all' || e.type === filter);
  return (
    <Page title="Customer History" back="/customers">
      {params.get('corrected') === '1' && (
        <p className="card note" role="status">
          Correction saved. The original entry stays in history.
        </p>
      )}
      <section className={`card ${current ? 'debt' : 'note'}`}>
        {customer.deleted && (
          <p className="small" role="status">
            Deleted customer · balance and history kept
          </p>
        )}
        <h2 className="customer-name">{customer.name}</h2>
        <p className="small muted">{customer.contactNumber || 'No contact number added'}</p>
        {customer.identifyingNote && <p className="small muted">{customer.identifyingNote}</p>}
        <p className={`eyebrow ${current ? 'utang' : 'payment'}`}>
          {current ? 'CURRENT UTANG' : 'FULLY PAID'}
        </p>
        <p className={`amount ${current ? 'utang' : 'payment'}`}>{money(current)}</p>
      </section>
      <div className="actions">
        <Link className="button plain" to={`/customers/${id}/edit`}>
          Edit customer
        </Link>
        <button className="button plain" onClick={() => setChangingStatus(true)}>
          {customer.deleted ? 'Restore customer' : 'Delete customer'}
        </button>
      </div>
      {customer.deleted ? (
        <p className="note">
          Restore this customer before recording new utang or payments. Their balance still counts
          in your store total.
        </p>
      ) : (
        <div className="actions">
          <Link className="button orange" to={`/utang/new?customer=${id}`}>
            + New utang
          </Link>
          {current > 0 ? (
            <Link
              className="button"
              to={`/payments/new?customer=${id}`}
              aria-label="Record Payment"
            >
              ↓ Payment
            </Link>
          ) : (
            <button className="button" disabled>
              Fully paid
            </button>
          )}
        </div>
      )}
      {!!customer.changes?.length && (
        <details className="customer-changes">
          <summary className="button plain">
            <span className="when-closed">Show changes</span>
            <span className="when-open">Hide changes</span>
          </summary>
          <section className="card stack" aria-label="Customer changes">
            <h2>Customer changes</h2>
            <PaginatedList
              items={[...customer.changes].reverse()}
              label="Customer changes"
              renderItem={(change) => {
                const when = storeNow(new Date(change.createdAt));
                return (
                  <article key={change.requestId} style={{ overflowWrap: 'anywhere' }}>
                    <strong>
                      {change.before.deleted !== change.after.deleted
                        ? change.after.deleted
                          ? 'Customer deleted'
                          : 'Customer restored'
                        : 'Customer details edited'}
                    </strong>
                    <p className="small muted">
                      <time dateTime={change.createdAt}>
                        {dateLabel(when.date)} · {timeLabel(when.time)}
                      </time>
                    </p>
                    {(
                      [
                        ['name', 'Name'],
                        ['contactNumber', 'Contact number'],
                        ['identifyingNote', 'Identifying note'],
                      ] as const
                    ).map(
                      ([key, label]) =>
                        change.before[key] !== change.after[key] && (
                          <p className="small" key={key}>
                            {label}: {change.before[key] || '(empty)'} →{' '}
                            {change.after[key] || '(empty)'}
                          </p>
                        ),
                    )}
                  </article>
                );
              }}
            />
          </section>
        </details>
      )}
      <h2>All history</h2>
      <p className="small muted">Utang + payments · latest first</p>
      <div className="chips" aria-label="Filter history">
        {[
          ['all', 'All'],
          ['utang', 'Utang'],
          ['payment', 'Payments'],
        ].map(([value, label]) => (
          <button key={value} onClick={() => setFilter(value)} aria-pressed={filter === value}>
            {label}
          </button>
        ))}
      </div>
      {rows.length ? (
        <PaginatedList
          key={`${id}:${filter}`}
          items={rows}
          label="Customer history"
          renderItem={(entry) => (
            <EntryRow key={entry.id} entry={entry} runningBalance={entry.runningBalance} />
          )}
        />
      ) : (
        <Empty>
          No {filter === 'all' ? 'entries' : filter === 'utang' ? 'utang entries' : 'payments'} yet.
        </Empty>
      )}
      {changingStatus && (
        <CustomerStatusDialog customer={customer} onClose={() => setChangingStatus(false)} />
      )}
    </Page>
  );
}

function CustomerStatusDialog({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const original = useRef(customer).current;
  const requestId = useRef(crypto.randomUUID());
  const saved = useRef(false);
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const restoring = !!original.deleted;
  return (
    <Dialog
      title={restoring ? 'Restore customer?' : 'Delete customer?'}
      onClose={() => {
        if (!saving.current) onClose();
      }}
    >
      <div className="stack">
        <p>
          {restoring
            ? `${original.name} will return to your active customers.`
            : `${original.name} will be flagged as deleted. Their balance and history will be kept, and you can restore them from Deleted customers.`}
        </p>
        <ErrorMessage message={error} />
        <button
          className="button"
          disabled={busy}
          onClick={async () => {
            if (saving.current) return;
            saving.current = true;
            setBusy(true);
            setError('');
            try {
              if (!saved.current) {
                await repository.changeCustomer(
                  {
                    customerId: original.id,
                    expectedRevision: original.revision ?? 0,
                    details: {
                      name: original.name,
                      contactNumber: original.contactNumber,
                      identifyingNote: original.identifyingNote,
                    },
                    deleted: !restoring,
                  },
                  requestId.current,
                );
                saved.current = true;
              }
              await queryClient.invalidateQueries({ queryKey: ['store'] }, { throwOnError: true });
              onClose();
            } catch (cause) {
              setError(
                saved.current
                  ? 'Change saved, but the notebook could not refresh. Retry to refresh.'
                  : cause instanceof Error
                    ? cause.message
                    : 'Couldn’t save. Try again.',
              );
            } finally {
              saving.current = false;
              setBusy(false);
            }
          }}
        >
          {busy ? 'Saving…' : restoring ? 'Confirm restore' : 'Confirm deletion'}
        </button>
        <button className="button plain" disabled={busy} onClick={onClose}>
          Cancel
        </button>
      </div>
    </Dialog>
  );
}
