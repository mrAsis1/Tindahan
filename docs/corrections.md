# Correcting an entry

Open a customer’s history and select **Correct entry** on the original transaction. Choose **Void and replace** or **Void only**, enter a reason, and select **Review correction**. Check the original amount, replacement details, and resulting current balance, then select **Confirm correction**.

The original remains visible as **Voided** with the reason, owner, and correction time. Its money amount and purchase/payment details are preserved, but it contributes zero to balances and daily totals. A replacement links back to the original. You can correct an active replacement again; each step stays in history. An already voided original cannot be corrected a second time.

## Rules

- The customer and entry type stay fixed. A replacement can change amount, date, and description. To address an entry on the wrong customer, void it if valid and create the appropriate new entry separately; transferring debts between customers is not implemented.
- A reason of 1–300 non-whitespace characters is required. Amounts must remain positive integer centavos within the existing limit; dates cannot be in the future.
- The entire resulting historical ledger must remain nonnegative. For example, voiding a purchase that funded a later payment is rejected, even if another purchase makes today’s balance positive. Resolve the incorrect related entries in a valid order.
- Replacements retain the original effective time and ordering position within that time. Their actual creation time is recorded separately. Changing the effective date moves that position to the new date. This avoids reordering a funded payment ahead of its corrected purchase when both were saved in the same second.
- Review is a preview; the database checks current records again during save. If another tab corrected the original first, the later save fails. Reopen current history before attempting a different correction.
- Retries retain their save ID. A matching retry succeeds once; reusing that ID with different details fails. If the save result is uncertain, retry the unchanged correction first or reload history to confirm what happened before making a new correction.

## Persistence and rollout

Local demo mode keeps correction records and entry metadata in the existing `tindahan.local-demo.v1` notebook. Old demo records without status remain active. Browser storage is still temporary, editable demo data, not an authorization or audit boundary.

Supabase migration `20260907090000_audited_corrections.sql` adds status/void metadata, replacement references, deterministic ordering fields, and correction audit fields. It adds `correct_entry` and updates the original write validation and entry JSON functions. Existing rows start active; the original migration is unchanged.

The RPC authenticates the owner, scopes the entry to the store, takes the shared owner transaction lock and row locks, preserves the original values, optionally inserts the replacement, validates all running balances, and writes audit events in one transaction. An error rolls back every part. The correction audit records the actor, original, reason, normalized request payload, and replacement. Browser roles cannot directly edit financial or audit rows.

Apply this additive migration before using the new UI in a hosted environment, and refresh app clients to load the status-aware balance calculations. Older clients do not understand voided entries. If a defect is found after corrections exist, keep the metadata and audit history and use a forward-fix migration; reverting to the old application would count voided entries again. No automated rollback or production deployment is provided.

## Validation

The embedded PostgreSQL suite applies all migrations in filename order. It verifies tenant isolation, denied direct writes, atomic rollback, duplicate/conflicting retries, invalid inputs, voiding payments, correction chains, and within-second ordering. Local tests check existing-notebook compatibility, totals, retries, and storage failure rollback. Browser tests exercise review/edit/confirm, void-only, rejection, failed-save retry, and reload persistence on mobile and desktop Chromium.

Physical devices and real multi-connection hosted concurrency remain follow-up checks. Account recovery is the next application feature.
