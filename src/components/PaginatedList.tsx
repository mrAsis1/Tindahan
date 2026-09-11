import { useRef, useState, type ReactNode } from 'react';

const PAGE_SIZE = 50;

// Items already contain complete-ledger totals/running balances. Only rendering is paged.
export function PaginatedList<T>({
  items,
  label,
  renderItem,
}: {
  items: T[];
  label: string;
  renderItem: (item: T) => ReactNode;
}) {
  const [requestedPage, setPage] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pages - 1);
  const start = page * PAGE_SIZE;
  function changePage(next: number) {
    setPage(next);
    requestAnimationFrame(() => {
      list.current?.focus({ preventScroll: true });
      list.current?.scrollIntoView({ block: 'start' });
    });
  }
  return (
    <>
      <div className="paged-records" ref={list} role="group" aria-label={label} tabIndex={-1}>
        {pages > 1 && (
          <p className="small muted" role="status">
            Showing {start + 1}–{Math.min(start + PAGE_SIZE, items.length)} of {items.length}
          </p>
        )}
        {items.slice(start, start + PAGE_SIZE).map(renderItem)}
      </div>
      {pages > 1 && (
        <div className="list-pagination" role="group" aria-label={`${label} pages`}>
          <button
            type="button"
            className="button plain"
            disabled={page === 0}
            onClick={() => changePage(page - 1)}
          >
            Previous
          </button>
          <span className="small">
            Page {page + 1} of {pages}
          </span>
          <button
            type="button"
            className="button plain"
            disabled={page === pages - 1}
            onClick={() => changePage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
