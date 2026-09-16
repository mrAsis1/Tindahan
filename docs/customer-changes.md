# Customer edits and deletion flags

Open a customer and choose **Edit customer** to correct their name, contact number or identifying note. Saving preserves their ID, balances and transactions. Changes are hidden by default; select **Show changes** to expand their history and **Hide changes** to collapse it. The history shows old and new values and the date/time, newest first. The owner remains recorded in the audit data but is not displayed beside the date. A save with no changes adds no history.

On **Add Utang** or **Add Payment**, type a customer name and select an existing-customer suggestion. Suggestions show active customer names with contact details and identifying notes. Deleted customers are hidden from both lists and searches; manage them under Customers → Deleted. Transaction fields and saving stay hidden until an active customer is selected. On Add Utang, a new name offers **Add a new customer**; confirm the prefilled name, then enter their utang. Typing a different name clears the previous selection and hides transaction fields while preserving draft values. Payments retain current-balance and overpayment checks.

**Delete customer** asks for confirmation and flags the record as deleted. It does not remove the customer, transactions or debt from store totals. Use **Customers → Deleted** (also available in Search) to open their history or choose **Restore customer**. Restoration is recorded too. Restore before adding new utang or payments; existing ledger corrections remain available.

Existing exact duplicates can be deleted and restored. Editing cannot introduce another matching name/contact/note combination, including a match with a deleted customer. The new-customer form links to matching deleted records so they can be restored instead of duplicated.

## Save and access guarantees

Utang and payment suggestions appear together in one bordered box. Existing customers appear before typing, filter as you type, and return when the input is cleared. The list uses the existing pagination and hides after selection. On Add Utang, **Add a new customer** appears only when no customer is selected and the search has no matching records.

- Customer changes use the existing owner-scoped audit table and transaction lock. Direct customer/audit writes remain prohibited.
- Each change carries a save ID and the revision seen when the form opened. Retries return without another history item; conflicting reuse and stale forms are rejected. Cancel and reopen a stale form to load current details.
- An uncertain cloud save keeps its original details for retry. A failed refresh retries the read without another write. Local storage failures leave the stored record unchanged.
- Full and scoped notebook reads, and the existing backup table set, retain the deletion flag and change history. Old local notebooks default to active customers with revision zero and no recorded changes; earlier edits cannot be reconstructed.

## Hosted rollout

The additive migration is `supabase/migrations/20260916090000_customer_changes.sql`. Apply migrations in order on the intended development project, verify with fictional customers, then deploy the matching frontend. Follow [Supabase setup](supabase-setup.md) and [the release workflow](branching.md). Do not reset the database or rerun earlier migrations.

On 16 September 2026, applied the missing `20260913090000` and `20260916090000` migrations to **Tindahan Development** (`bzkbndvmspnyjkuyaudr`) after a dry run and 26 passing targeted tests. All five local/remote migration versions now match. A request to `change_customer` without an owner session returns `42501` (permission denied), confirming that the function is available and anonymous access remains blocked. No customer or ledger records were edited during verification. Frontend deployment and other Supabase projects are unchanged.

## Verification

Confirmed test boundaries: customer screens and local/cloud save interfaces. Tests cover before/after history, deletion/restoration, balance preservation, reloads, retry identity, stale revisions, malformed details, duplicate protection, local write failures, owner isolation and denied direct writes. Cloud UI failure checks use fictional HTTP responses; SQL checks run the migrations in embedded PostgreSQL. A signed-in hosted customer change remains unverified; hosted migration history and the API access check passed as recorded above.

Build, all 69 unit/database tests and all 88 browser tests passed. Changed-file formatting passed. The repository-wide formatting check reports existing issues in untouched `src/lib/api/authOptions.ts`, `tests/e2e/recovery.spec.ts`, `tests/unit/auth-session.test.ts` and `docs/login-sessions.md`.
