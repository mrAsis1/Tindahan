import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { refreshData, repository, useData } from '../../app/data';
import { Dialog, Empty, ErrorMessage, Field, Page, SummaryRow } from '../../components/ui';
import { assertLedger, balance } from '../../lib/ledger';
import { money, parseMoney } from '../../lib/money';
import { correctionSchema } from '../../lib/validation';
import { storeNow } from '../../lib/dates';
import type { CorrectionInput, LedgerEntry } from '../../types';

export function CorrectionForm() {
  const { id } = useParams();
  const data = useData();
  const navigate = useNavigate();
  const entry = data.entries.find((e) => e.id === id);
  const [mode, setMode] = useState('replace');
  const [amount, setAmount] = useState(entry ? (entry.amountCentavos / 100).toFixed(2) : '');
  const [date, setDate] = useState(entry?.effectiveDate ?? '');
  const [description, setDescription] = useState(entry?.description ?? '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [review, setReview] = useState<{ input: CorrectionInput; remaining: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const requestId = useRef(crypto.randomUUID());
  if (!entry)
    return (
      <Page title="Entry not found" back="/customers">
        <Empty>This entry is not in your notebook.</Empty>
      </Page>
    );
  const customer = data.customers.find((c) => c.id === entry.customerId)!;
  const replacement = data.entries.find((e) => e.replacesEntryId === entry.id);
  const label =
    entry.type === 'payment' ? 'Payment' : entry.type === 'utang' ? 'Utang' : 'Opening balance';
  return (
    <Page title="Correct entry" back={`/customers/${customer.id}`}>
      <section className="card">
        <h2>{customer.name}</h2>
        <SummaryRow label={`Original ${label.toLowerCase()}`} value={money(entry.amountCentavos)} />
        <p className="small muted">
          {entry.effectiveDate} · {entry.description || label}
        </p>
      </section>
      {entry.status === 'voided' ? (
        <section className="card note">
          <h2>Voided entry</h2>
          <p>{entry.voidReason}</p>
          <p className="small muted">
            The original stays in history and is excluded from balances.
          </p>
          {replacement && (
            <Link className="button plain" to={`/transactions/${replacement.id}/correct`}>
              View replacement
            </Link>
          )}
        </section>
      ) : (
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            setError('');
            try {
              const input = correctionSchema.parse({
                entryId: entry.id,
                reason,
                replacement:
                  mode === 'void'
                    ? null
                    : { amountCentavos: parseMoney(amount), description, effectiveDate: date },
              });
              const proposed: LedgerEntry[] = data.entries.map((e) =>
                e.id === entry.id ? { ...e, status: 'voided' } : e,
              );
              if (input.replacement)
                proposed.push({
                  ...entry,
                  ...input.replacement,
                  id: requestId.current,
                  requestId: requestId.current,
                  createdAt: new Date().toISOString(),
                  orderCreatedAt: entry.orderCreatedAt ?? entry.createdAt,
                  orderId: entry.orderId ?? entry.id,
                });
              assertLedger({ ...data, entries: proposed });
              setReview({ input, remaining: balance(proposed, customer.id) });
            } catch (cause) {
              setError(
                cause instanceof Error && 'issues' in cause
                  ? 'Enter a reason, a positive amount, and a valid date no later than today.'
                  : cause instanceof Error
                    ? cause.message
                    : 'Check the correction details.',
              );
            }
          }}
        >
          <p className="small muted">
            The original stays in history as Voided. Customer and entry type stay the same.
          </p>
          <Field label="Correction action" id="correction-action">
            <select id="correction-action" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="replace">Void and replace</option>
              <option value="void">Void only</option>
            </select>
          </Field>
          {mode === 'replace' && (
            <>
              <Field label="Correct amount" id="correct-amount">
                <input
                  id="correct-amount"
                  inputMode="decimal"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
              <Field label="Correct date" id="correct-date">
                <input
                  id="correct-date"
                  type="date"
                  min="1900-01-01"
                  max={storeNow().date}
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field label="Correct description (optional)" id="correct-description">
                <textarea
                  id="correct-description"
                  maxLength={300}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
            </>
          )}
          <Field label="Reason for correction" id="correction-reason">
            <textarea
              id="correction-reason"
              required
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <ErrorMessage message={error} />
          <button className="button" type="submit">
            Review correction
          </button>
          <Link className="button plain" to={`/customers/${customer.id}`}>
            Cancel
          </Link>
        </form>
      )}
      {review && (
        <Dialog
          title="Confirm correction"
          onClose={() => {
            if (!saving.current) setReview(null);
          }}
        >
          <div className="stack">
            <p>
              {review.input.replacement
                ? `Void the original ${money(entry.amountCentavos)} entry and replace it with ${money(review.input.replacement.amountCentavos)}.`
                : `Void this ${money(entry.amountCentavos)} entry without a replacement.`}
            </p>
            {review.input.replacement && (
              <p>
                {review.input.replacement.effectiveDate} ·{' '}
                {review.input.replacement.description || label}
              </p>
            )}
            <p>Reason: {review.input.reason}</p>
            <SummaryRow label="Current balance after correction" value={money(review.remaining)} />
            <p className="small muted">
              The complete ledger is checked again when you save. The original and reason remain in
              history.
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
                  await repository.correctEntry(review.input, requestId.current);
                  await refreshData();
                  navigate(`/customers/${customer.id}?corrected=1`);
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : 'Couldn’t save. Your correction details are still here.',
                  );
                } finally {
                  saving.current = false;
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Saving correction…' : 'Confirm correction'}
            </button>
            <button className="button plain" disabled={busy} onClick={() => setReview(null)}>
              Keep editing
            </button>
          </div>
        </Dialog>
      )}
    </Page>
  );
}
