# Scoped notebook reads

Home, customer lists, customer history, and Daily Record no longer need every store transaction in each Supabase response. The additive migration `20260910090000_scoped_notebook_reads.sql` provides `read_notebook(p_view, p_day, p_customer_id)`. It has been tested in disposable embedded PostgreSQL, **not applied to the hosted development project**. Deployment remains deferred.

## What each screen loads

| Screen                                                  | Entries returned                                             | Supporting data                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Home                                                    | Three most recent entries, including retained voided records | Names for those entries, whole-store outstanding/count, selected day's active utang/payment totals |
| Customers / Search                                      | None                                                         | All customers and their complete current balances, including zero balances                         |
| Customer history                                        | That customer's complete history                             | Customer identity and all original/replacement/void metadata                                       |
| Daily Record                                            | Entries effective on the selected day                        | Names for those entries, day totals and whole-store closing balance through that date              |
| Customer/transaction/correction forms and confirmations | Complete notebook through the existing `get_notebook()`      | Existing historical validation, retry and confirmation behavior                                    |

Display pagination remains 50 rows. A customer with 4,000 entries still downloads all 4,000 when opening their history; a busy day still downloads that day's entries. This change scopes requests to the screen, rather than adding server page cursors. Further optimization of large individual histories, days, and write-form loading remains possible.

## Financial and access guarantees

- PostgreSQL computes summary amounts from active entries across the full relevant ledger. Voided originals remain in returned history/day lists but contribute zero to totals. Opening balances contribute to outstanding and day opening totals.
- Complete customer history is ordered with the same effective-date/time and inherited replacement position as the original ledger. Filtering and rendering pages happen after running balances are computed.
- The read function is `STABLE`, so summaries and details share the calling statement's database snapshot. Every table read explicitly filters the authenticated owner's store. Anonymous/public execution is revoked. Existing RLS policies, write locks, validation functions and audit records are unchanged.
- Query cache keys include owner and view, with day/customer where relevant. Writes invalidate every notebook view; inactive summaries refetch when revisited. Sign-out/recovery still clear notebook caches. Failure to load one view never fills it with another view's cached entries or totals.
- The local demo reads and validates its original complete browser notebook, then projects the requested view in memory. Scoped snapshots are never written to demo storage. Supabase reads do not create or use the demo storage key.
- The client validates scoped response shapes and safe integer amounts. A missing migration reports a setup error; it does not silently download the full notebook or switch storage modes.

## Verification and limits

Database tests compare every scoped view with the old complete read after corrections, replacement chains, voided payments and opening balances, across multiple customers. They check other-owner access, an empty store, missing authentication and invalid parameters. An additional 500-customer/20,000-entry SQL fixture verifies totals and response reduction using the real migration/functions; it is isolated from Supabase and bulk inserts fictional test records only in disposable PostgreSQL.

Browser regressions cover pagination, correction/save flows, cached summary refresh after payment, failed scoped-read retry and missing-migration handling. The performance harness refuses full-notebook reads on its measured routes, checks payload limits, and uses precomputed fictional server responses. Its timings do not measure SQL execution or hosted network latency. See [performance measurements](pilot-performance.md).

## Deferred rollout

Before running this version against Supabase, review the new migration and follow [the setup guide](supabase-setup.md): confirm the intended development project, inspect migration history and the dry run, then apply the pending migration when rollout resumes. Do not repair it as already applied or rerun/edit the two existing migrations.

Apply the read function before publishing the matching frontend. The existing hosted frontend continues to use `get_notebook()` and remains compatible with this additive migration. If a frontend rollback is needed, restore the previous frontend; the new read function can stay installed without deleting records or reverting the schema.

After rollout, verify totals/history with preserved fictional records on the development backend and record the physical phone/browser/network used. Production setup, email, backup restoration and a small-store pilot remain separate readiness work.
