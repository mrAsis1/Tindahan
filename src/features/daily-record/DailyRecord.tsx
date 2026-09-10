import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../../app/data';
import { Dialog, Empty, EntryRow, Field, Page, SummaryRow } from '../../components/ui';
import { PaginatedList } from '../../components/PaginatedList';
import { dateLabel, storeNow, validDate } from '../../lib/dates';
import { dailySummary } from '../../lib/ledger';
import { money } from '../../lib/money';

function Calendar({
  selected,
  onSelect,
  onClose,
}: {
  selected: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(selected);
  const [month, setMonth] = useState(selected.slice(0, 7));
  const today = storeNow().date;
  const [year, monthNumber] = month.split('-').map(Number);
  const offset = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  function move(delta: number) {
    setMonth(new Date(Date.UTC(year, monthNumber - 1 + delta, 1)).toISOString().slice(0, 7));
  }
  return (
    <Dialog title="Calendar" onClose={onClose}>
      <div className="stack">
        <p className="muted small">Choose a day to view its records.</p>
        <div className="card">
          <div className="calendar-heading">
            <button
              className="back"
              onClick={() => move(-1)}
              disabled={month <= '1900-01'}
              aria-label="Previous month"
            >
              ‹
            </button>
            <h3>
              {new Intl.DateTimeFormat('en-PH', {
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              }).format(new Date(`${month}-01T12:00:00Z`))}
            </h3>
            <button
              className="back"
              onClick={() => move(1)}
              disabled={month >= today.slice(0, 7)}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <div className="calendar">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <span key={i} className="small muted">
                {d}
              </span>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const date = `${month}-${String(i + 1).padStart(2, '0')}`;
              return (
                <button
                  key={date}
                  aria-label={dateLabel(date)}
                  aria-pressed={value === date}
                  disabled={date > today}
                  onClick={() => setValue(date)}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
        <Field label="Or choose a date" id="calendar-date">
          <input
            id="calendar-date"
            type="date"
            min="1900-01-01"
            max={today}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (validDate(e.target.value)) setMonth(e.target.value.slice(0, 7));
            }}
          />
        </Field>
        <button
          className="button"
          disabled={!validDate(value) || value > today}
          onClick={() => onSelect(value)}
        >
          View daily record
        </button>
        <button className="button plain" onClick={() => onSelect(today)}>
          View today
        </button>
        <button className="button plain" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Dialog>
  );
}

export function DailyRecord() {
  const { entries, customers } = useData();
  const [params, setParams] = useSearchParams();
  const today = storeNow().date;
  const requested = params.get('date') ?? today;
  const day = validDate(requested) && requested <= today ? requested : today;
  const [calendar, setCalendar] = useState(false);
  const summary = useMemo(() => dailySummary(entries, day), [entries, day]);
  const names = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers]);
  const net = summary.utang - summary.payments;
  return (
    <Page title="Daily Record">
      <button
        className="button plain"
        onClick={() => setCalendar(true)}
        aria-label="Choose record date"
      >
        {day === today ? 'Today · ' : ''}
        {dateLabel(day)} ▦
      </button>
      <section className="card">
        <h2>Daily summary</h2>
        <SummaryRow label="Utang given" value={money(summary.utang)} tone="utang" />
        <SummaryRow label="Payments collected" value={money(summary.payments)} tone="payment" />
        {summary.opening > 0 && (
          <SummaryRow label="Opening balances added" value={money(summary.opening)} />
        )}
        <SummaryRow
          label="Net change"
          value={`${net < 0 ? '−' : '+'}${money(Math.abs(net))}`}
          tone={net < 0 ? 'payment' : 'utang'}
        />
        <SummaryRow label="Total outstanding" value={money(summary.closing)} />
        <p className="small muted">Outstanding utang at the end of this day.</p>
      </section>
      <h2>{summary.entries.length} transactions · latest first</h2>
      {summary.entries.length ? (
        <PaginatedList
          key={day}
          items={summary.entries}
          label="Daily transactions"
          renderItem={(entry) => (
            <EntryRow key={entry.id} entry={entry} name={names.get(entry.customerId)!} />
          )}
        />
      ) : (
        <Empty>No transactions on this day.</Empty>
      )}
      {calendar && (
        <Calendar
          selected={day}
          onSelect={(date) => {
            setParams({ date });
            setCalendar(false);
          }}
          onClose={() => setCalendar(false)}
        />
      )}
    </Page>
  );
}
