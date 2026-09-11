# Production and recovery configuration checklist

Prepared 11 September 2026 from `develop` at `14fe3d7` (PR #14). **Stage 5: Readiness is open. Deployment is deferred.** This document prepares configuration and evidence; it does not create services, change hosted settings, authorize spending or approve a release.

Development update: on 11 September 2026 the owner authorized the free development migration. It is applied and read-only verification passed; frontend publication and production remain pending. The owner also specified **free services only**. This does not select or upgrade a production service.

## Environments and current evidence

| Environment          | Purpose and current status                                                                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local demo           | Fictional browser notebook only. Separate storage; never a cloud recovery fallback.                                                                                                      |
| Automated tests      | Disposable fictional APIs/PGlite; 59 unit/database, 78 browser and 12 performance tests passed at PR #14.                                                                                |
| Hosted development   | Existing private Sites app and Supabase project `bzkbndvmspnyjkuyaudr`. Preserve its fictional records. Owner reported phone entry/history/recovery passing on the older hosted version. |
| Recovery destination | Separate disposable destination for a hosted restoration rehearsal; not yet selected or configured.                                                                                      |
| Production           | Separate Supabase project and hosting configuration; not yet selected or configured. No real store pilot approved.                                                                       |

Git branches do not separate databases. `develop` and preview builds must not use production connection values. The existing `.env.local`, `supabase/config.toml` and Sites metadata describe development; do not copy them unchanged into production or blindly push their configuration.

## Owner decisions before configuring services

Record choices here when agreed. Nothing in this table is a configured default.

| Decision                                                        | Current value                                             | Needed to proceed                                                      |
| --------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| Production host, HTTPS address and tester access                | Pending; Vercel was discussed but deployment was deferred | A chosen host/address and access suitable for the intended store owner |
| Monthly service budget                                          | Free services only                                        | Hosting, database, email and backup costs accepted before provisioning |
| Production database region/project                              | Pending                                                   | Separate production project, region and public project identifier      |
| Email provider and sender domain/address                        | Pending                                                   | Sender ownership, provider choice and private SMTP configuration       |
| Maximum acceptable data loss                                    | Pending                                                   | How much recent work can be re-entered after failure                   |
| Maximum acceptable recovery time                                | Pending                                                   | How long the store can operate without the app                         |
| Backup method, frequency, retention and protected copy location | Pending                                                   | A method meeting the two recovery targets, with a tested restore       |
| Pilot owner, device/browser/network and duration                | Pending                                                   | A small agreed trial and a way to report problems                      |

Passwords, SMTP credentials, database connection secrets and reset-link tokens stay in private service settings or a password manager, never this table or chat.

## Configuration and verification order

Complete each item with a date, source commit, environment and evidence link. Unchecked means pending, not failed.

### 1. Validate the pending development version

- [ ] Resume development rollout explicitly. Check the linked project identifier and remote migration history before any change.
- [ ] Verify `20260906090000_create_tindahan.sql` and `20260907090000_audited_corrections.sql` remain installed. Repository records say both are applied; do not rerun them.
- [ ] Review and dry-run the pending `20260910090000_scoped_notebook_reads.sql`, then apply it to development before publishing the matching frontend. It was applied to development on 11 September 2026; frontend publication is still pending. Follow [scoped-read rollout](scoped-notebook-reads.md).
- [ ] Verify preserved fictional balances/history and repeat [phone checks](hosted-phone-checks.md) on the updated version. Record phone, browser and network. The previous phone pass does not certify the pending frontend or large-notebook speed.
- [ ] Assess [performance limits](pilot-performance.md): reduced form payloads are proven, but simulated slow-phone openings of 2.3–2.9 seconds do not pass the two-second or physical-device acceptance target.

### 2. Prepare isolated production configuration

- [ ] Select the separate project and create its owner account privately with public signup disabled. Verify another owner cannot read or write the first owner's records. Do not migrate development fixtures into the real store notebook.
- [ ] For a new empty project, review and apply all three migrations in order, recording their actual application. Verify RLS, RPC permissions, audit tables and retry constraints. Never mark a migration applied merely to clear a pending status.
- [ ] Set the production build's `VITE_DATA_BACKEND=supabase`, `VITE_SUPABASE_URL` to the production URL, and `VITE_SUPABASE_PUBLISHABLE_KEY` to that project's public publishable key. Never include a secret/service-role key. Rebuild after changing values: [Vite embeds these variables at build time and exposes `VITE_` values to the browser](https://vite.dev/guide/env-and-mode).
- [ ] Use the pinned Node/npm versions in the repository, install from the lockfile, run the checked build and publish only its static output. Verify the built app contacts the intended project, shows owner sign-in and does not show local-demo mode.
- [ ] Configure HTTPS and SPA fallback. Direct navigation/reload must work for customer history, transaction confirmations, `/auth/forgot-password` and `/auth/reset-password`. Verify the intended owner can reach the app through any hosting access gate.
- [ ] Keep development/preview variables distinct. Review host Git integration before enabling it: pushing a branch or merging `main` must not unexpectedly publish an unapproved build.

### 3. Verify production email and recovery

- [ ] Set Supabase Site URL to the chosen production HTTPS origin and allow the exact `<production-origin>/auth/reset-password` callback. Review required redirects rather than copying development localhost or wildcard entries. See [Supabase redirect guidance](https://supabase.com/docs/guides/auth/redirect-urls).
- [ ] Configure custom SMTP and a verified sender using the provider's domain-verification instructions. Review delivery limits and disable link rewriting/tracking that breaks reset URLs. Supabase's default email service is intended for non-production use; see [SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp) and [production guidance](https://supabase.com/docs/guides/deployment/going-into-prod).
- [ ] Check sender identity, template branding and callback destination without recording tokens. From the intended physical phone, request one reset email, use the newest link, update the password privately, sign in again and confirm the same notebook. Record delivery outcome and elapsed time. Follow [account recovery](account-recovery.md).
- [ ] Verify expired/rejected links and retry messages with fictional tests. Avoid repeatedly sending live email to probe rate limits. A green local test does not prove delivery to the pilot owner's inbox.

### 4. Prove hosted recovery

- [ ] Configure the agreed backup policy and a way to notice failed or stale backups.
- [ ] Restore fictional records into a separate destination and complete the [hosted restoration evidence record](backup-restoration.md#hosted-evidence-record--pending). Verify data, corrections, audits, owner identity/access, new writes and duplicate retries.
- [ ] Measure actual data loss and restoration/verification time against the agreed targets. Recheck Auth/email and external settings that a database backup does not restore. The passing PGlite rehearsal does not close this item.

### 5. Release and small-store pilot

- [ ] Close the preceding evidence gaps or record a concrete owner decision about any remaining limitation before real store use. Do not mark Stage 5 complete just because CI is green.
- [ ] Prepare a reviewed, checked release PR from `develop` to `main`, tag the release and record the deployed commit and migration versions. Follow [branching](branching.md); keep `main` reserved for releases.
- [ ] Record a known compatible frontend rollback build. A rollback must preserve ledger data and remain compatible with the installed schema; restoring an old database can lose newer entries and is not an ordinary frontend rollback.
- [ ] Verify initial store balances and opening-record procedure before entry. Opening-balance import UI remains unimplemented; do not invent starting balances or use development fixtures as real accounts.
- [ ] Run the agreed small-store pilot. Check daily totals against the store's independent records and record errors, confusing steps, save delays and recovery issues. After an uncertain save, keep the form for its original retry or inspect history before starting another entry.
- [ ] Review pilot results before expanding use. Continue fixes on task branches from `develop`, followed by checked release PRs.

## Release evidence record

All production fields are pending. Record host/address, database identifier, release commit/tag, applied migrations, build-environment verification, email/phone checks, backup/restore evidence, accepted performance limits, pilot scope, rollback build and owner release decision. Link results without including private customer data or credentials.

The next dependency is the owner's service and recovery decisions above when setup resumes. This checklist alone does not approve deployment, close readiness, or configure recurring backups.
