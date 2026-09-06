import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { dateLabel, timeLabel } from '../lib/dates';
import { money } from '../lib/money';
import type { Customer, LedgerEntry } from '../types';

export function Page({
  title,
  children,
  back,
  brand = 'YOUR STORE NOTEBOOK',
}: {
  title: string;
  children: ReactNode;
  back?: string;
  brand?: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = `${title} · Tindahan`;
    heading.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [title]);
  return (
    <>
      <header className="screen-header">
        {back ? (
          <Link className="back" to={back}>
            ‹ Back
          </Link>
        ) : (
          <p className="brand">{brand}</p>
        )}
        <h1 ref={heading} tabIndex={-1}>
          {title}
        </h1>
      </header>
      <main id="main" className="content">
        {children}
      </main>
    </>
  );
}
export function SummaryRow({
  label,
  value,
  tone = '',
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="summary-row">
      <span className="muted">{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
export function ErrorMessage({ message }: { message?: string }) {
  return message ? (
    <p className="error" role="alert">
      {message}
    </p>
  ) : null;
}
export function Field({
  label,
  error,
  children,
  id,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  id: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      <ErrorMessage message={error} />
    </div>
  );
}
export function CustomerRow({ customer, balance }: { customer: Customer; balance: number }) {
  return (
    <Link to={`/customers/${customer.id}`} className="record customer-row">
      <div>
        <strong>{customer.name}</strong>
        <p>{balance ? 'Current utang · View history →' : 'Fully paid · View history →'}</p>
        {(customer.contactNumber || customer.identifyingNote) && (
          <p>{[customer.contactNumber, customer.identifyingNote].filter(Boolean).join(' · ')}</p>
        )}
      </div>
      <strong className={balance ? 'utang' : 'payment'}>{money(balance)}</strong>
    </Link>
  );
}
export function EntryRow({
  entry,
  name,
  runningBalance,
}: {
  entry: LedgerEntry;
  name?: string;
  runningBalance?: number;
}) {
  const payment = entry.type === 'payment';
  const label = payment
    ? 'Payment'
    : entry.type === 'opening_balance'
      ? 'Opening balance'
      : 'Utang';
  const body = (
    <>
      <div>
        <strong>{name ?? (entry.description || label)}</strong>
        <p>
          {name ? `${entry.description || label} · ` : ''}
          {dateLabel(entry.effectiveDate)} · {timeLabel(entry.effectiveTime)}
        </p>
        {runningBalance !== undefined && <p>Balance: {money(runningBalance)}</p>}
      </div>
      <div className={`record-amount ${payment ? 'payment' : 'utang'}`}>
        <strong>
          {payment ? '−' : '+'}
          {money(entry.amountCentavos)}
        </strong>
        <span>{label}</span>
      </div>
    </>
  );
  return name ? (
    <Link className="record" to={`/customers/${entry.customerId}`}>
      {body}
    </Link>
  ) : (
    <article className="record">{body}</article>
  );
}

export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose} aria-labelledby="dialog-title">
      <div className="dialog-head">
        <h2 id="dialog-title">{title}</h2>
        <button type="button" className="back" onClick={onClose} aria-label="Close dialog">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
