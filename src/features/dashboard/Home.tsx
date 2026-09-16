import { Link } from "react-router-dom";
import { useData, useReadTotals } from "../../app/data";
import { Empty, EntryRow, Page, SummaryRow } from "../../components/ui";
import { dateLabel, storeNow } from "../../lib/dates";
import { chronological } from "../../lib/ledger";
import { money } from "../../lib/money";
import { backendMode } from "../../lib/api/supabase";

export function Home() {
  const { entries, customers } = useData();
  const totals = useReadTotals()!;
  const today = storeNow().date;
  const recent = chronological(entries).reverse().slice(0, 3);
  return (
    <Page title="Magandang araw!" brand="TINDAHAN">
      <p className="muted small">{dateLabel(today, true)}</p>
      <section className="card hero">
        <p className="eyebrow">TOTAL DEBT</p>
        <p className="amount">{money(totals.outstanding)}</p>
        <p className="small">{totals.withBalance} customers with a balance</p>
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
        <h2>Today’s Overview</h2>
        <SummaryRow
          label="New utang"
          value={money(totals.utang)}
          tone="utang"
        />
        <SummaryRow
          label="Payments received"
          value={money(totals.payments)}
          tone="payment"
        />
      </section>
      <section className="card recent-activity" aria-label="Recent activity">
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
          <Empty>
            No entries yet. Add a customer and their first utang to get started.
          </Empty>
        )}
      </section>
      <Link className="button plain" to="/daily-record">
        View daily record →
      </Link>
      {backendMode === "local" && (
        <p className="small muted">
          Fictional starting records are dated 25 Aug–5 Sep 2026. Choose 5
          September in Daily Record to explore them.
        </p>
      )}
    </Page>
  );
}
