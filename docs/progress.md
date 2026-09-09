# Tindahan progress

## Private development hosting — 9 September 2026

- Started from current `develop` on `codex/chore/development-hosting`.
- Registered the owner-only Tindahan Development Site at `https://tindahan-development.monarchrenante27.chatgpt.site`. Added the Site manifest with Vite static output and single-page route fallback.
- Prepared the Supabase Site URL and exact hosted recovery callback while preserving local reset callbacks. No schema migration, account recreation, or ledger changes are required.
- Added [hosting and phone-testing instructions](development-hosting.md), including the separate ChatGPT access gate, Tindahan owner login, build-time public settings, and reset-link handling.
- Hosting validation and deployment completion are tracked in this task and its feature pull request. Physical phone testing is the owner's next check; production email, backups, and performance remain future work.

## Hosted save validation — 9 September 2026

- Started from current `develop` on `codex/feature/hosted-save-validation`; original designs and migrations preserved.
- Recorded the owner's confirmation that the live password reset and new-password sign-in worked on 8 September. No owner password was handled by the agent.
- Added an opt-in CLI harness for the development database. All three hosted checks passed: competing payments cannot overpay, simultaneous duplicate requests create one entry/audit, and retries after discarded committed responses return the original while conflicting payloads are rejected. Observed distinct PostgreSQL backends and lock waits under the authenticated database role.
- Five clearly labeled fictional customers remain from two runs, all verified at zero balance. No records were deleted. See [hosted validation results and fixture IDs](hosted-save-validation.md).
- Fixed utang/payment retry handling after lost responses and failed post-save refreshes. Confirmed writes retry only the refresh; uncertain writes retain the original details/request ID even after the displayed balance changes. Confirmed validation rejections still allow editing. Cached forms remain mounted on background refresh errors.
- Added eight mobile/desktop cloud browser cases using intercepted HTTP responses, bringing the browser suite to 60 cases. Production build and 46 unit/PostgreSQL tests passed; final browser/CI results are recorded with the feature pull request.
- Hosted checks use the Management API plus authenticated-role RPCs, not end-to-end hosted Auth/PostgREST browser calls. Browser failure tests use a fictional API. Open-form retry state is not persisted across reload/navigation; check history before starting another uncertain save. No offline queue or backend migration was added.
- Next: publish a development frontend URL for phone testing, then physical-device checks, production email setup, backup restoration, and pilot performance work.

## Owner password recovery — 7–8 September 2026

### Completed

- Continued from `develop` on `codex/feature/owner-recovery`, following the feature → pull request → develop workflow.
- Added reset-email requests, generic account-existence confirmation, password validation, expired/rejected link handling, recovery callback routing, and return to sign-in after updating the password.
- Recovery waits for the Auth SDK to process the callback before displaying account state. Callback parameters are removed, recovery does not load the notebook, and account query caches are cleared on exit. Failed sign-out after a successful update has a separate retry action.
- Added four exact development callback URLs for ports 5173/5174 to hosted Auth. The CLI verification reports all config up to date. Existing signup, email, MFA, and database settings are preserved; no migration or ledger write was required.
- Added [account recovery instructions](account-recovery.md). Supabase recovery is separate from the fictional local demo.

### Validation and next steps

- Production build and 46 unit/PostgreSQL tests passed locally. Added 22 recovery browser cases across mobile and desktop, alongside the existing 30 ledger/browser cases. The Auth cases use the installed SDK with fictional intercepted responses, not hosted credentials.
- This Windows session could not launch Playwright Chromium (`spawn UNKNOWN`, before test code ran). [PR #3](https://github.com/mrAsis1/Tindahan/pull/3) passed formatting, build, 46 unit/PostgreSQL tests, and all 52 mobile/desktop browser tests on [GitHub's Linux runner](https://github.com/mrAsis1/Tindahan/actions/runs/34147365347). Integration follows the checked feature pull request into `develop`; `main` remains the release baseline.
- The first Linux run caught same-tab callback handling and the SDK clearing a session after failed global sign-out. Fixed callback reinitialization and changed recovery sign-out to end other sessions before the current one, preserving a retry session when the first request fails. Added same-tab valid-link and cancel/sign-out regression cases.
- The owner confirmed that the reset email arrived. Opening it on a phone produced “site can’t be reached” because the development redirect uses loopback (`127.0.0.1`), which points to the phone itself. The app is running on this computer at ports 5173 and 5174; complete the reset from email on this computer. A deployed HTTPS frontend is needed for normal phone recovery.
- The owner confirmed on 8 September that the reset worked and new-password sign-in succeeded. No owner password was handled or changed by the agent.
- Live recovery is complete. Hosted save validation continues in the newer section above; physical-device checks and production email/hosting/backup preparation remain future work.

## Audited transaction corrections — 7 September 2026

### Completed

- Started from current `develop` on `codex/feature/transaction-corrections`.
- Added customer-history correction links, void-only and void/replacement forms, a required reason, review/confirmation, retained failed-save details, and visible original/replacement history. Voided confirmations no longer present an old entry as active.
- Updated balances and daily totals to exclude voided entries while retaining their history. Replacement chains keep their original ordering position within the effective time, including transactions saved in the same second; actual creation timestamps stay separate.
- Added compatible local-demo correction records and a Supabase `correct_entry` adapter. The local storage key and original fictional data remain intact.
- Added the new transactional migration `20260907090000_audited_corrections.sql`, preserving the first migration. Owner-scoped correction RPCs share normal-write locks, preserve original values, enforce the full historical ledger, reject conflicting retries, and atomically append correction/replacement audit events. Browser direct writes remain denied.
- Added [correction instructions and rollout details](corrections.md).

### Validation and next steps

- Production build passed. **44 unit/PostgreSQL tests passed** across the full migration chain, including 10 new correction tests. **30 browser tests passed** across mobile and desktop, including 8 new correction scenarios. Reviewed the mobile history screenshot with original/replacement details.
- Applied the reviewed corrections migration to **Tindahan Development** through the CLI. Both migration versions match local/remote history; a subsequent dry run reports no pending changes.
- Verified the hosted correction flow on **Demo Customer (setup check)**: replaced the fictional ₱150 utang with ₱175 (₱25 current balance), then corrected that replacement back to ₱150 (₱0 balance). Reloaded the hosted records and confirmed the preserved originals, reasons, owner/time labels, and replacement chain. The notebook now has five fixture entries: two voided utang versions, one active ₱150 utang, and the original ₱50/₱100 payments. No records were deleted.
- Published `codex/feature/transaction-corrections` and opened [PR #2](https://github.com/mrAsis1/Tindahan/pull/2) into `develop`. GitHub's build, formatting, 44 unit/PostgreSQL tests, and 30 browser tests passed. Integration follows the reviewed pull request; `main` is unchanged.
- Next: owner account recovery, followed by real hosted concurrency/uncertain-response tests, physical-device checks, and production preparation.

## Development workflow and migration history — 7 September 2026

### Completed

- Preserved the clean existing `main` history at `94d0c8a`, confirmed it matches `origin/main`, and created `develop` from it.
- Started this task on `codex/chore/development-workflow`. Documented feature/fix/chore branches into `develop`, releases into `main`, and optional release/hotfix branches created when needed in [the branch guide](branching.md).
- Added a concise pull request template and GitHub Actions checks for formatting, build, unit/SQL tests, and mobile/desktop browser tests. Checks use local demo mode, pinned action revisions, and no Supabase credentials or automatic deployment.
- Completed Supabase CLI browser login, linked this checkout to **Tindahan Development** (`bzkbndvmspnyjkuyaudr`), and verified that the five tables and four public RPCs exist through hosted schema type inspection.
- Confirmed the initial migration was missing from remote history, marked `20260906090000` applied, and verified local/remote history matches. `db push --dry-run` returned `upToDate: true` with no migrations, seeds, or roles pending. The original SQL was not rerun; notebook data was preserved.
- CLI login and ignored link metadata stay outside tracked source. Git branches do not create separate Supabase environments. Production hosting/database setup and GitHub branch protection remain separate future configuration.

### Verification and next steps

- Published `develop` and `codex/chore/development-workflow` to the existing private repository. [PR #1](https://github.com/mrAsis1/Tindahan/pull/1) targets `develop`; `main` remains at the existing baseline.
- Local formatting and diff checks passed. The first [GitHub Actions run](https://github.com/mrAsis1/Tindahan/actions/runs/34052556904) passed the complete build, formatting, unit/PostgreSQL, and mobile/desktop browser checks on Linux. Integration proceeds through the reviewed pull request after its checks pass.
- Next application work: audited corrections and owner account recovery, followed by concurrent hosted saves, uncertain retry handling, and physical-device testing.

Earlier sections below record historical milestone status; migration-history setup is now complete.

## Supabase setup — 6 September 2026

### Completed

- Created the repository's Supabase CLI configuration, environment example, and initial transactional migration. The user created **Tindahan Development** (`bzkbndvmspnyjkuyaudr`) in Supabase and supplied its URL and public publishable key.
- Verified that the hosted public schema was empty, then applied `supabase/migrations/20260906090000_create_tindahan.sql` through SQL Editor. Verified all five tables have RLS enabled, anonymous reads denied, and direct authenticated inserts denied.
- Added owner profiles, one store per owner, customers, ledger entries, audit events, indexes, amount/date constraints, and customer/store composite foreign keys.
- Added authenticated RPCs for store/customer creation, ledger writes, and one consistent notebook snapshot. Writes use an owner transaction lock and customer row lock, validate the full chronological ledger, preserve request IDs, reject conflicting retries, and commit audit events atomically.
- Added explicit `local` / `supabase` modes, email/password owner sign-in, sign-out, private store setup, a Supabase repository adapter, account-scoped query keys, and cache clearing on account changes.
- Stored only the project URL and public publishable key in ignored `.env.local`. Cloud mode never falls back to local writes, imports demo records, or exposes the Reset demo action.
- The local demo and original designs remain available unchanged. Browser tests run separately on port 4178 and force local mode, so cloud records are untouched by that suite.
- Added [setup instructions](supabase-setup.md), including the distinction between dashboard and owner accounts, Auth settings, and registering this manually applied migration in CLI history before future pushes.
- The user created the development owner account and signed in. Verified authenticated store creation and created the **Tindahan** notebook. Disabled public signup in hosted Auth; saved `http://127.0.0.1:5173` as the Site URL and `http://localhost:5173` as an allowed redirect.

### Validation and remaining setup

- Production build and TypeScript check passed.
- **34 tests passed**: original 26 plus 8 tests executing the actual migration against embedded PostgreSQL, covering roles/RLS, owner isolation, restricted writes, idempotency, and historical payment rollback. Only the Supabase Auth users/uid interface is stubbed.
- **22 browser regression tests passed** in mobile and desktop Chromium using local mode.
- Hosted SQL migration and table security checks passed. Owner sign-in, store setup, customer creation within Add Utang, search, utang, partial/full payments, and reload persistence were verified through the running app against Supabase.
- Live fixture: **Demo Customer (setup check)**, labeled fictional with no real debt/payments. Saved ₱150 utang, then ₱50 payment; verified ₱100 persisted after a full page reload. Saved another ₱100 payment; customer and dashboard now show ₱0 outstanding, with ₱150 new utang and ₱150 payments in today's totals. The customer and three test entries remain as development examples; no records were deleted.
- Passwords were entered only by the user and were not handled or stored by the agent. Session persistence was checked on reload; sign-out/re-sign-in and cross-device access were not separately exercised in the live check.
- Full hosted concurrency/network-failure tests, physical-device checks, recovery, corrections, and production readiness remain outstanding. Docker was unavailable; the embedded SQL suite is not a full local Supabase stack.
- The schema was applied in SQL Editor. CLI login/link and migration-history repair remain manual follow-up steps documented in the setup guide; do not blindly push the already-applied initial migration.

### Next steps

1. Register the applied migration in CLI history before the next database change.
2. Add audited corrections and account recovery.
3. Test concurrent hosted saves, uncertain retries, sign-out/re-sign-in, and physical-device access before a real-data pilot.

The older milestone notes below describe the state at that milestone's completion, before Supabase was added.

## First implementation milestone — 6 September 2026

Scope: a working mobile-first local demo for a solo developer. This is the first **implementation** milestone, separate from the specification's earlier requirements/prototype milestone numbering.

### Completed

- Inspected the original README and both `design/` references before implementation. The existing design files are unchanged; the README's specification is preserved with a new quick-start section.
- Read the latest Figma page and design context for Home `2:179`, Daily Record `2:180`, Search `2:181`, Customers `2:182`, History `2:183`, Add Utang `2:184`, Add Payment `2:185`, Payment Saved `2:187`, Calendar `2:189`, and New Customer `2:192`. File: [Tindahan](https://www.figma.com/design/2vMuyrygWKheCvyQt2480z/Tindahan?node-id=2-179).
- Set up React, TypeScript, Vite, React Router, TanStack Query, React Hook Form, Zod, and Tailwind CSS. Package versions and npm lockfile are pinned; Inter is bundled locally.
- Built four labeled bottom tabs, dashboard, customer directory and search, customer history with filters, customer creation, transaction forms, confirmations, and calendar/day selection.
- Customer creation supports optional phone and distinguishing note, duplicate names, and zero starting balance. Creating a customer from Add Utang preserves the parent form's amount, description, and date.
- Added integer-centavo money handling, chronological running balances, derived dashboard/day/customer totals, full and partial payments, amount/date validation, and historical negative-balance rejection.
- Added stable save IDs, repeated-save detection, same-origin Web Locks when supported, pending submission controls, failed-save messages with retained fields, empty/fully-paid states, and corrupt-data handling that preserves the original stored value.
- Seeded six fictional customers matching the reference's ₱4,850 total, multiple days, optional contacts, and a fully paid customer. Kept the original dates rather than silently moving old records to today.
- Added a visible local-demo label, refresh persistence, cross-tab query refresh, and confirmed demo reset/empty notebook actions.

### Implementation decisions

- Keep the code in feature folders with a small set of shared controls. Financial calculations and validation are plain functions, separate from React and storage.
- Figma uses a prepared phone status bar; the app uses that space for a truthful local-demo label. Forms start with blank amounts and explicit customer selection. Native inputs and a keyboard-accessible calendar dialog support real entries. The optional identifying note and history filters extend the reference's core layouts.
- The original design's navigation icons are text glyphs; the app uses those same glyphs. No temporary remote image URLs are required.
- Confirmations show the balance immediately before/after the entry at its chronological position. This stays accurate for backdated entries; customer history separately shows the current balance.
- Effective time is the current Manila clock time at save, including on a backdated date. It is not editable in this milestone. Creation time is separately stored in UTC. Order is effective date, effective time, creation time, then ID.
- Each amount is limited to ₱9,999,999.99, with total safe-integer checks. Opening balances are supported by the domain model and tested separately from daily new utang; a migration UI is deferred.

### Temporary local storage versus planned Supabase

`src/lib/api/localRepository.ts` is the **only temporary persistence adapter**. It uses `tindahan.local-demo.v1` in browser `localStorage`; components do not read or write browser storage. `src/app/data.tsx` wires the adapter to TanStack Query and handles cross-tab updates.

There is **no Supabase client, database, authentication, owner/store access policy, remote backup, or sync** yet. No backend credentials are needed. Browser locks only coordinate participating tabs of this demo on browsers supporting Web Locks; they do not provide production authorization or server-side financial integrity. Browser storage can be cleared, modified, or become unavailable. Do not use it for real balances.

For the backend milestone, replace the adapter at the provider boundary, retain shared types and client validation, and implement authoritative checks in transactional PostgreSQL RPC functions. Never substitute a sequence of independent client-side balance reads and writes for a database transaction.

### Validation

- `npm run build`: passed strict TypeScript checking and the Vite production build.
- `npm test`: **26 passed**. Covers centavo parsing, Manila dates, reference totals, running balances, partial/full/overpayments, idempotent retries and conflicts, similar/duplicate names, backdating, invalid inputs, opening balances, storage failures, and corrupt-data preservation/reset.
- `npm run test:e2e`: **22 passed** (11 scenarios each on mobile and desktop Chromium). Both primary flows pass, including customer creation within Add Utang, refresh persistence, validation, calendar/cancel behavior, an empty notebook, failed saves, 320px layout checks, repeated submissions, and simultaneous payments from two tabs.
- Visually inspected screenshots at 390×844 and 1280×1000 for Home, payment entry, and customer history against Figma. Long content scrolls above the bottom navigation. Screenshots and browser traces are temporary ignored test outputs.
- Browser tests caught and verified the fix for a new customer being saved but not visibly selected in the parent form. The picker now has a controlled value. The browser-only lock path is excluded from Node unit-test execution.
- Source is formatted with pinned Prettier; `npm run format:check` verifies formatting. The original `design/` files have no changes.
- Coverage is Chromium desktop and mobile emulation, not physical-device, Safari, or production-backend verification.

### Next steps, in order

1. Confirm owner sign-in method and correction requirements; keep one owner/one store for the first release.
2. Add Supabase migrations for owner/store/customer/ledger/audit records, constraints, indexes, and store-scoped row-level access policies.
3. Implement atomic utang/payment RPCs with customer locking, payload-aware idempotency, deterministic historical validation, and audit writes. Deny financial table writes that bypass them.
4. Add owner authentication and a Supabase repository adapter, then integration-test isolation between two owners and concurrent/uncertain save retries.
5. Add audited void/replacement corrections and an explicit notebook opening-balance import/reconciliation workflow.
6. Test on physical Android and iOS devices; add browser coverage, pagination/performance checks against the README's pilot data volume, and automated CI checks.
7. Choose staging/production hosting, configure SPA route fallbacks, and verify backup restoration before a real-data pilot.

### Continue locally

```sh
npm ci
npm run dev
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

No deployment or remote push is part of this milestone. See the README's quick-start section for the two demo flows and seed dates.
