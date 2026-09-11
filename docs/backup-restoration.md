# Backup and restoration readiness

## Current evidence — 11 September 2026

Stage 5 remains in progress. The automated **fictional local database restoration rehearsal passed**. No hosted backup was taken or restored, no production backup schedule is configured, and deployment remains deferred. This is recovery evidence for the application database, not a completed Supabase disaster-recovery exercise.

Run the rehearsal with:

```sh
npx vitest run tests/unit/backup-restore.test.ts
```

It also runs with `npm test` and in GitHub's Build and test check. The test creates an isolated PGlite database, applies the repository's three migrations, and creates two fictional owners. Supabase Auth's identity function and user table are minimal test stubs; passwords, email delivery and actual sign-in are not tested.

The fixture contains a ₱20 opening balance, a ₱150 purchase corrected to ₱120, a ₱50 payment, and a separate ₱10 purchase voided with a reason. Expected outstanding is **₱90**, with five retained ledger rows including two voided originals. The test writes a serialized database archive to a uniquely named temporary file, checks its SHA-256 after reading it back, closes the source, and loads a fresh database from those bytes. The archive is removed after the test; it is not an operational backup.

Verification compares every row and field in owner profiles, stores, customers, ledger entries and audit events, plus the complete owner notebook. It checks scoped history and the expected balance; retries the saved payment and correction without adding rows or audit events; rejects changed retry details, excess payment, cross-owner access and direct/anonymous writes or reads as applicable; then records the remaining ₱90 payment successfully. An extra purchase made after the archive was taken is absent after restore, explicitly demonstrating the recovery cutoff.

PGlite's archive format is intended for reloading PGlite, not for importing into a hosted PostgreSQL/Supabase project. The checksum proves these test bytes survived the file round trip; it does not verify off-site retention or authenticate a real backup. See the [PGlite archive API](https://pglite.dev/docs/api).

## Hosted rehearsal when preparation resumes

Use a separate disposable recovery destination and fictional records. Preserve the development source and its records. Before any hosted restore, identify the source, destination, backup timestamp, deployed commit and actually applied migration versions. The pending scoped-read migration must not be recorded as already installed merely because it is in Git. Do not point the existing app at the recovery destination during the exercise.

1. Confirm the account's available backup method and retention. Do not assume a plan or that automatic backups exist. Follow the current [Supabase backup guide](https://supabase.com/docs/guides/platform/backups).
2. Choose a supported restore into the separate destination: [restore to a new project](https://supabase.com/docs/guides/platform/clone-project) where available, or the [CLI backup/restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Check inclusion of schema, data, roles, Auth identities and migration history. Keep connection credentials private and out of Git, logs and chat.
3. Restore and compare table counts, IDs, amounts, dates, correction links/reasons and audit records against the source at the backup cutoff. Verify expected customer and whole-store balances, history and Daily Record totals. A readable file or matching row count alone is insufficient.
4. Verify owner sign-in, owner separation, duplicate retry behavior and a new fictional transaction on the recovered app. Reconfigure and test recovery email, redirect URLs and required project settings separately. Supabase's database clone does not copy all service configuration or Storage objects; inventory these if used.
5. Record elapsed restore and verification time, newest recovered entry, missing post-backup entries, failures and outcome. Keep the source untouched until the recovery result has been reviewed. A real cutover is a separate release decision.

## Decisions required before real store records

The owner still needs to choose an acceptable maximum data-loss window and recovery time, then select a backup method, frequency, retention and protected storage location that meet them. These values are not agreed or configured by this rehearsal. Test recovery again after material schema or backup-method changes and on an agreed recurring schedule.

Git protects application source history, not customer balances. A notebook screen response omits database security, Auth and audit information and must not be treated as a full database backup. Local demo browser storage remains separate from Supabase and is not a fallback for a failed cloud restore.

### Hosted evidence record — pending

Record source/destination identifiers (no secrets), backup method and timestamp, source release/applied migrations, archive checksum if available, pre/post record and balance comparisons, identity/access checks, save/retry checks, restoration duration, known data loss, and the owner's acceptance. All hosted fields remain pending; the local test does not populate them.
