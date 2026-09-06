import { Link } from 'react-router-dom';
import { useData } from '../../app/data';
import { Empty, EntryRow, Page, SummaryRow } from '../../components/ui';
import { dateLabel, storeNow } from '../../lib/dates';
import { balance, chronological, dailySummary } from '../../lib/ledger';
import { money } from '../../lib/money';
import { backendMode } from '../../lib/api/supabase';

export function Home() {
  const { entries, customers } = useData();
  const today = storeNow().date;
  const daily = dailySummary(entries, today);
  const recent = chronological(entries).reverse().slice(0, 3);
  return (
    <Page title="Magandang araw!" brand="TINDAHAN">
      <p className="muted small">{dateLabel(today, true)}</p>
      <section className="card hero">
        <p className="eyebrow">TOTAL OUTSTANDING UTANG</p>
        <p className="amount">{money(balance(entries))}</p>
        <p className="small">
          {customers.filter((c) => balance(entries, c.id) > 0).length} customers with a balance
        </p>
      </section>
      <div className="actions">
        <Link className="button orange" to="/utang/new">
          + Add Utang
        </Link>
        <Link className="button" to="/payments/new">
          ↓ Add Payment
        </Link>
      </div>
      <section className="card">
        <h2>Today at a glance</h2>
        <SummaryRow label="New utang" value={money(daily.utang)} tone="utang" />
        <SummaryRow label="Payments received" value={money(daily.payments)} tone="payment" />
      </section>
      <h2>Recent activity</h2>
      {recent.length ? (
        recent.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            name={customers.find((c) => c.id === entry.customerId)!.name}
          />
        ))
      ) : (
        <Empty>No entries yet. Add a customer and their first utang to get started.</Empty>
      )}
      <Link className="button plain" to="/daily-record">
        View daily record →
      </Link>
      {backendMode === 'local' && (
        <p className="small muted">
          Fictional starting records are dated 25 Aug–5 Sep 2026. Choose 5 September in Daily Record
          to explore them.
        </p>
      )}
    </Page>
  );
}
