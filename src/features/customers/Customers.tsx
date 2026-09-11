import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useData, useReadTotals } from '../../app/data';
import { CustomerRow, Empty, EntryRow, Field, Page } from '../../components/ui';
import { PaginatedList } from '../../components/PaginatedList';
import { balance, history } from '../../lib/ledger';
import { money } from '../../lib/money';

export function Customers({ search = false }: { search?: boolean }) {
  const { customers } = useData();
  const totals = useReadTotals()!;
  const [query, setQuery] = useState('');
  const balances = useMemo(
    () => new Map(totals.balances.map((b) => [b.customerId, b.amount])),
    [totals],
  );
  const searchTerm = query.trim().toLocaleLowerCase();
  const matches = customers.filter((c) => c.name.toLocaleLowerCase().includes(searchTerm));
  return (
    <Page title={search ? 'Search' : 'Customers'}>
      {!search && (
        <Link className="button plain" to="/customers/new">
          + Add customer
        </Link>
      )}
      <p className="muted small">Find a customer and their balance.</p>
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
      <PaginatedList
        key={searchTerm}
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
      {!matches.length && (
        <Empty>
          {customers.length
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
        <h2 className="customer-name">{customer.name}</h2>
        <p className="small muted">{customer.contactNumber || 'No contact number added'}</p>
        {customer.identifyingNote && <p className="small muted">{customer.identifyingNote}</p>}
        <p className={`eyebrow ${current ? 'utang' : 'payment'}`}>
          {current ? 'CURRENT UTANG' : 'FULLY PAID'}
        </p>
        <p className={`amount ${current ? 'utang' : 'payment'}`}>{money(current)}</p>
      </section>
      <div className="actions">
        <Link className="button orange" to={`/utang/new?customer=${id}`}>
          + New utang
        </Link>
        {current > 0 ? (
          <Link className="button" to={`/payments/new?customer=${id}`} aria-label="Record Payment">
            ↓ Payment
          </Link>
        ) : (
          <button className="button" disabled>
            Fully paid
          </button>
        )}
      </div>
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
    </Page>
  );
}
