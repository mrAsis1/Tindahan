import { Link, useParams } from 'react-router-dom';
import { useData } from '../../app/data';
import { Empty, Page, SummaryRow } from '../../components/ui';
import { history, signedAmount } from '../../lib/ledger';
import { dateLabel, timeLabel } from '../../lib/dates';
import { money } from '../../lib/money';
import { backendMode } from '../../lib/api/supabase';

export function Confirmation() {
  const { id } = useParams();
  const { entries, customers } = useData();
  const entry = entries.find((e) => e.id === id);
  if (!entry)
    return (
      <Page title="Entry not found" back="/home">
        <Empty>This transaction is not in your notebook.</Empty>
      </Page>
    );
  const customer = customers.find((c) => c.id === entry.customerId)!;
  if (entry.status === 'voided')
    return (
      <Page title="Voided entry" back={`/customers/${customer.id}`}>
        <p>This original entry is excluded from balances.</p>
        <p>Reason: {entry.voidReason}</p>
        <Link className="button" to={`/transactions/${entry.id}/correct`}>
          View correction
        </Link>
      </Page>
    );
  const payment = entry.type === 'payment';
  const running = history(entries, customer.id).find((e) => e.id === id)!.runningBalance;
  return (
    <Page title={payment ? 'Payment Saved' : 'Utang Saved'} back="/home">
      <div className="success" role="status">
        <div className="checkmark" aria-hidden="true">
          ✓
        </div>
        <h2>{payment ? 'Payment recorded' : 'Utang saved'}</h2>
        <p className="muted">{customer.name}</p>
        <p className={`amount ${payment ? 'payment' : 'utang'}`}>{money(entry.amountCentavos)}</p>
      </div>
      <section className="card">
        <h2>Balance updated</h2>
        <SummaryRow label="Previous balance" value={money(running - signedAmount(entry))} />
        <SummaryRow
          label={payment ? 'Payment received' : 'New utang'}
          value={`${payment ? '−' : '+'}${money(entry.amountCentavos)}`}
          tone={payment ? 'payment' : 'utang'}
        />
        <SummaryRow
          label="Balance after this entry"
          value={money(running)}
          tone={running ? 'utang' : 'payment'}
        />
        <p className="small muted">
          {dateLabel(entry.effectiveDate)} · {timeLabel(entry.effectiveTime)}
        </p>
        {entry.description && <p className="small muted">{entry.description}</p>}
      </section>
      <Link className="button" to={`/customers/${customer.id}`}>
        View customer history
      </Link>
      <Link className="button plain" to="/home">
        Back to Home
      </Link>
      <p className="small muted">
        {backendMode === 'local' ? 'Saved in this browser.' : 'Saved to your store account.'} For
        backdated entries, customer history shows today’s balance too.
      </p>
    </Page>
  );
}
