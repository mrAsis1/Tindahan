# Tindahan progress

## Development scoped-read migration applied — 11 September 2026

- Started from clean `develop` at `a3515d4` (checked PR #15) on `codex/chore/apply-development-scoped-reads`. The owner authorized the next database step if free and specified free services only. Stage remains **5: Readiness**.
- Verified the existing development link `bzkbndvmspnyjkuyaudr`, both installed migration versions and a dry run showing only `20260910090000_scoped_notebook_reads.sql`. Applied that additive function successfully without creating/upgrading services or changing billing. All three versions now match; the post-application dry run is empty.
- Added an opt-in read-only hosted verifier. Home, directory, seven customer histories and two entry dates match the original full notebook, including balances and correction metadata. Anonymous and missing-owner access are rejected. All 7 customers, 20 ledger rows and 30 audit rows retain identical before/after fingerprints; outstanding remains ₱0. No fixtures or financial writes were needed. [Detailed evidence](scoped-notebook-reads.md#development-migration-results--11-september-2026).
- Updated current setup/README/readiness records while preserving historical progress. Frontend publication, Vercel configuration, physical-phone testing of this version, production recovery and the pilot remain pending. `main` is unchanged; no new browser/phone acceptance is claimed by the SQL check.
- Validation: hosted read-only verification and migration history/dry-run checks passed. Script syntax and changed-file formatting checks also passed; final-commit GitHub checks must pass before the reviewed PR merges into `develop`.
- Next: prepare the Vercel testing handoff with explicit development connection values, nested-route fallback and recovery callback requirements. The owner plans to connect Vercel; a production release still requires the remaining readiness decisions/evidence.

## Production and recovery configuration checklist — 11 September 2026

- Started from clean, up-to-date `develop` at `14fe3d7`, the checked merge of PR #14, on `codex/chore/production-readiness-checklist`. Stage remains **5: Readiness**; deployment is deferred.
- Added [production readiness](production-readiness.md): environment separation, the pending development migration/frontend sequence, production build variables, exact recovery callbacks, custom SMTP verification, hosted restoration, release/rollback evidence and the small-store pilot. Linked existing evidence rather than treating local tests as hosted acceptance.
- Host/address, service budget, sender/provider, backup policy, acceptable loss/recovery time and pilot scope remain explicit pending owner decisions. No service, account, hosting configuration, migration, application behavior or data was changed; `main` remains the release baseline.
- Reviewed repository settings and current official Vite/Supabase guidance. Documentation formatting and relative-file-link checks passed; the final-commit GitHub checks must pass before merging the reviewed PR into `develop`.
- Next dependency: choose the production services and recovery targets when setup resumes, then perform the checklist's development rollout and hosted evidence checks. This preparation does not authorize deployment or complete Stage 5.

## Fictional database backup-restoration rehearsal — 11 September 2026

- Started from clean, up-to-date `develop` at `af3fcd9`, the checked merge of PR #13, on `codex/chore/backup-restore-rehearsal`. Stage remains **5: Readiness**; deployment is deferred.
- Added a repeatable PGlite archive/file/restore test using all three repository migrations and fictional owners, opening balance, payments, replacement and void corrections. The source is closed before a fresh database loads the archive. Exact application-table/audit/notebook comparisons, the expected ₱90 balance, owner isolation, write restrictions, duplicate payment/correction retries and a new payment to zero passed. A post-backup transaction is intentionally absent after restore, demonstrating the recovery cutoff.
- The archive stays in a uniquely named temporary file and is removed after the test. No hosted data, credentials, local-demo storage, application code, dependencies, migrations or release settings changed. This PGlite-only recovery test does not certify Supabase Auth, email, hosted backups, off-site retention or production recovery time.
- Added the [recovery guide](backup-restoration.md), with a separate-destination hosted rehearsal and an evidence record. Backup frequency, retention, acceptable data loss and recovery time remain owner decisions before real store use; no operational backup policy was silently chosen.
- Validation: the focused restoration test, TypeScript check, all **59 unit/PostgreSQL tests** and formatting (including `.github`) passed. Final-commit GitHub build, browser and performance checks must pass before the reviewed PR merges into `develop`.
- Next: prepare the production/recovery configuration checklist while deployment remains deferred. Hosted backup restoration, real-device/network acceptance of pending changes, production/email setup and the small-store pilot remain open gates.

## Smaller transaction-form and confirmation reads — 11 September 2026

- Started from clean, up-to-date `develop` at `45d7f75`, the checked merge of PR #12, on `codex/fix/scoped-transaction-reads`. Stage remains **5: Readiness**; deployment stays deferred.
- Forms now use the existing directory read and its complete per-customer balances. New transaction confirmations include the selected customer in their URL and load that customer's complete history. Existing write validation, historical checks, invalidation and uncertain-save retry logic are preserved. Legacy confirmation links without a customer and correction forms keep complete reads; mismatched hints do not fall back to another customer's/full notebook.
- Reused the already-tested read API; no new migration, dependency, hosted configuration or notebook-data change. The existing scoped-read migration is still pending on hosted development. Local demo projections remain separate from persisted complete storage. `main` is unchanged.
- All **12 performance/startup cases passed**. Form/refresh payloads fell from about **5.9 MB to 121 KB (98% less)**; both tested flows together downloaded about **88% less notebook data**. Constrained simulated-phone opening observations improved from **5.8–6.4 to 2.3–2.9 seconds**. Complete long-history confirmations remain about 1.15 MB, and the extra confirmation request still adds a round trip. [Results and preserved baseline](pilot-performance.md#smaller-transaction-form-and-confirmation-reads--11-september-2026) retain these limits; performance acceptance remains open.
- Final local formatting (including `.github`), production build/type checking, **58 unit/PostgreSQL tests**, all **78 browser regressions**, and all **12 performance/startup cases** passed. Six new mobile/desktop cases cover selected-customer balances, scoped/legacy/mismatched/voided confirmation links, and failed confirmation-history reads. Confirmed writes retain the form until refreshed history is ready; retries perform reads without another write. The final 20 focused cloud-save cases also passed after guarding against a spurious overpayment warning during confirmation loading. An initial browser run had a correction timeout while development-page reloads cleared its draft; the entire suite passed with files held fixed, without weakening tests or timeouts. Final-commit GitHub checks must pass before merging the reviewed task into `develop`.
- Next readiness work: prepare and verify a backup-restoration rehearsal. Physical-phone/network verification of the pending frontend, production/email setup and a small-store pilot remain outstanding; retain the measured cold-start/long-history limits for those checks.

## Large-notebook transaction forms and connection model — 11 September 2026

- Started from clean, up-to-date `develop` at `a0362f8`, the checked merge of PR #11, on `codex/chore/form-network-checks`. Stage remains **5: Readiness**; deployment is deferred.
- Added four optimized-build scenarios for Add Utang and Add Payment with 500 fictional customers and 20,000 entries, including a 4,000-entry customer. Desktop and fourfold-slowed mobile run with a 150 ms baseline or a modeled 400 ms plus 1 Mbit/s gzip-sized JSON transfer delay. This is a deterministic response-delay model, not actual network shaping or verification of hosted compression.
- Verified customer selection, exact current/preview/confirmation balances, reachable save controls, disabled pending saves, preserved failed-payment amount, identical retry payload/request ID, and exactly two in-memory entries. No hosted writes or local-demo storage are used. Existing database and physical-phone checks remain distinct evidence.
- The complete **12 performance/startup cases passed**, followed by all four final form cases with preview/paint timing. Final simulated-phone form openings were **3.0–3.5 seconds baseline** and **5.8–6.4 seconds constrained**; amount/preview interaction stayed below 0.2 seconds. Each scenario fetched the full roughly 5.9 MB notebook four times: two form opens and two post-save refreshes. [Measurements and limits](pilot-performance.md#large-notebook-forms-and-connection-model--11-september-2026) preserve the earlier run's variation.
- This task adds tests and records only; it does not claim a speedup or complete performance acceptance. Application, dependencies, existing data, migrations and hosted configuration remain unchanged. The earlier scoped-read migration and matching frontend are still undeployed; `main` remains the release baseline.
- Final local formatting (including `.github`), production build/type checking, **58 unit/PostgreSQL tests** and **72 browser regressions** passed. Merge the reviewed task into `develop` only after the final-commit GitHub checks pass.
- Next: reduce full-notebook form/refresh reads while preserving backend financial checks and uncertain-save retries. Production/email preparation, backup restoration, physical-phone/network verification and a small-store pilot remain outstanding readiness work.

## Browser startup runtime investigation — 10 September 2026

- Started from clean, up-to-date `develop` at `594e9bc`, the checked merge of PR #10, on `codex/fix/startup-runtime`. Current stage remains **5: Readiness**; deployment stays deferred.
- Repeated the unchanged application before selecting another optimization. The initial slowed-mobile Home median was 682 ms, substantially below the prior session without a source change. Runtime profiling did not reproduce a multi-second application stall. Host/runtime variation prevents attributing these faster timings to an app improvement.
- Added test-only browser measurements for actual Home content, a subsequent paint opportunity, notebook request/response boundaries and long tasks. Preserved existing interaction timings, financial assertions and isolated fictional responses. Added optional first-navigation CPU profiles, explicitly marked and saved separately for diagnosis.
- The unprofiled suite passed all **eight performance/startup checks**. Slowed-mobile Home interaction medians were **680–814 ms**; browser Home paint-opportunity medians were **575–680 ms**. Every measured interaction in this run stayed below two seconds, but this does not complete hosted/physical-phone acceptance or erase prior slower results. See [the investigation and retained baselines](pilot-performance.md#browser-startup-investigation--10-september-2026).
- No application, financial, focus/accessibility, dependency, schema, storage or hosted changes were justified by this investigation. The startup asset remains 596,830 bytes. The earlier scoped-read migration and matching frontend remain undeployed; `main` stays reserved for releases.
- Final local validation passed formatting (including `.github`), production build/type checking, **58 unit/PostgreSQL tests**, **72 browser regressions**, all **eight performance/startup checks**, and the optional mobile CPU-profile run. Integration requires a reviewed pull request into `develop` with successful final-commit GitHub checks.
- Next: measure full-notebook transaction-form loading with the pilot dataset, which existing read benchmarks do not cover. Physical-device/network verification, production/email setup, backup restoration and the small-store pilot remain separate readiness gates.

## Deferred form loading and startup profiling — 10 September 2026

- Continued from clean, up-to-date `develop` at `affac24`, the checked merge of PR #9, on `codex/fix/startup-loading`. Current stage remains README milestone **5: Readiness**, with deployment deferred.
- Profiled the optimized module graph and a three-sample desktop browser baseline. Home downloaded one roughly 641 KB JavaScript file, including React Hook Form and all transaction/customer/correction screens. Deferred customer creation, transaction forms, corrections and confirmations until their routes open. Home, directory, history, Daily Record and authentication initialization remain eager.
- Added a loading state and recoverable page error boundary. Failed page downloads offer manual reload or return to Home; the app does not automatically reload a form. Existing storage, financial logic, dependency versions and recovery initialization are unchanged.
- Added optimized-build browser checks for deferred asset requests, direct form reload, input interaction, a 620 KB initial-JavaScript budget and recovery after a blocked form download. The pilot report now also records actual startup script bytes, DOM readiness and first contentful paint, separately from notebook-ready timings.
- No migration, hosted configuration, notebook data, deployment, or release-branch changes. The scoped-read migration from PR #9 remains pending on hosted development; rollout still requires that migration before publishing the matching frontend.
- Browser measurements confirm startup JavaScript fell from **641,414 to 596,830 bytes (6.95%)**. The final performance run passed all four correctness/isolation scenarios plus four optimized-build asset/recovery checks. Slowed-mobile Home medians were 3.38–3.73 seconds, with no consistent timing gain over the prior run; the **two-second target remains not passed**. Preserved baselines and measured limits are in [the performance guide](pilot-performance.md).
- Local formatting (including `.github`), production build/type checking, **58 unit/PostgreSQL tests**, and **72 mobile/desktop browser regressions** passed. [PR #10](https://github.com/mrAsis1/Tindahan/pull/10) tracks the reviewed change; merge its final head only after the complete GitHub checks pass. `main` remains the release baseline.
- Next: investigate the remaining interval between script response and first paint using controlled runtime profiling, and address large individual history/day and full-notebook form loading. Hosted physical-phone/network verification, production setup/email, backup restoration and a small-store pilot remain separate gates; deployment stays deferred.

## Scoped notebook loading — 10 September 2026

- Started from clean, up-to-date `develop` at `035e7ca`, the checked merge of PR #8, on `codex/feature/scoped-notebook-reads`. Stage remains README milestone **5: Readiness**; deployment is still deferred by the owner.
- Added screen-specific reads for Home (three recent entries plus whole-ledger totals), Customers/Search (customers and balances without entries), one customer's complete history, and a selected day's entries/totals. Write/correction forms and confirmations retain the complete notebook and existing historical/retry checks. Display pagination remains 50 rows; this is not server-cursor pagination.
- Added `20260910090000_scoped_notebook_reads.sql`, preserving the two existing migrations and full-read/write APIs. The new read-only function uses an authenticated owner scope and a consistent statement snapshot. It has **not been applied to hosted development**. The matching frontend is not published; existing hosted records/app and `main` are unchanged. See [rollout and limitations](scoped-notebook-reads.md).
- Query caches now distinguish owner, view, day and customer. Saves invalidate all notebook views. Added failure/retry and stale-summary checks; missing migration reports setup failure without a full-read or local-demo fallback. Local demo projections stay in memory and never overwrite stored records.
- Local validation: **58 unit/PostgreSQL tests** passed, including comparisons against complete snapshots after audited corrections and a real-SQL 500-customer/20,000-entry fixture. All original **66 browser regressions** passed, followed by **14 cloud-read/save cases** including six new mobile/desktop cases (72 total cases in the complete suite).
- All **four performance scenarios** passed correctness, network-isolation and payload-limit assertions. Home's fictional notebook response fell from about 5.9 MB to 1.7 KB; slowed-mobile Home medians improved to 3.23–3.47 seconds and day medians to 2.02–4.03 seconds. The **two-second target remains not passed**. See [measurements and preserved earlier baselines](pilot-performance.md).
- Final local formatting (including `.github`) and production build/type checking passed. [PR #9](https://github.com/mrAsis1/Tindahan/pull/9) tracks the reviewed change; merge its final head only after the complete GitHub checks pass. Integration does not apply the pending migration or publish the frontend.
- Next: profile remaining browser startup and large individual history/day/write-form loading. When development rollout resumes, apply the reviewed additive migration before publishing its frontend, then verify preserved fictional records on a recorded physical phone/browser/network. Production setup/email, backup restoration and the small-store pilot remain separate gates.

## Notebook rendering and validation performance — 10 September 2026

- Continued from clean, up-to-date `develop` at `839e3d5`, the verified merge of [PR #7](https://github.com/mrAsis1/Tindahan/pull/7). Created `codex/fix/notebook-performance`. The owner asked to continue readiness work and explicitly deferred deployment.
- Current stage remains README milestone **5: Readiness**. Added 50-row pages to customer directories, customer histories, and Daily Record. Search uses all customers; changing search, history filter, or day returns to page one. Page controls move focus and scroll to the new rows.
- Balances, filtered running balances, daily totals, and correction history are calculated from the full ledger before paging. Home/customer balance lookup now uses one ledger pass; repeated date/currency formatting reuses formatters. Current-time formatting is reused only for the same exact epoch second, with fresh-clock, midnight, backward-clock, and returned-object mutation checks.
- Added three unit regressions and six mobile/desktop browser cases covering page boundaries, older-entry corrections, retained voided originals, refreshed balances, search, day changes, and narrow layout. The original functional/browser tests and historical records remain intact.
- No schema/migration, hosted data, Supabase configuration, deployment, or existing local notebook was changed. The isolated performance harness continues to block unexpected network traffic and uses disposable fictional data. `main` remains reserved for releases.
- Final local performance run passed all four scenarios. Desktop Home/day medians improved from 2.65–3.10 seconds to 0.92–1.39 seconds; slowed-mobile medians improved from 26.10–27.67 seconds to 9.86–11.85 seconds. The concentrated mobile history first page measured 2.74 seconds versus 22.58 seconds for the old complete list. The **two-second target remains not passed**; mobile results vary, and not every short interaction improved. See [the preserved baseline and new measurements](pilot-performance.md).
- Local validation: final formatting and production build/type checking passed; 51 unit/PostgreSQL tests passed after the final clock change; all 66 mobile/desktop browser regressions passed for the pagination change. [PR #8](https://github.com/mrAsis1/Tindahan/pull/8) tracks this work. Its final head must also pass the full checked pull-request workflow before merging into `develop`.
- Next: profile the remaining full-notebook loading cost and reduce it while preserving complete totals/correction history, then verify development-backend performance on a recorded physical device/network. Production setup/email, backup restoration, and the small-store pilot remain separate gates. Deployment stays deferred at the owner's request.

## Phone entry confirmation and pilot performance baseline — 10 September 2026

- Established the starting point from the repository: clean `develop` at `d0c147b` (merged PR #6), up to date with origin. Started `codex/chore/pilot-performance-checks` from that branch. Earlier milestone notes below remain historical records.
- Current stage is README milestone **5: Readiness**. Customer records, ledger, summaries, corrections, and owner recovery are implemented. Hosted ledger checks, physical-phone history, and hosted phone recovery passed previously.
- The owner replied **“its fine”** to the requested physical-phone transaction-entry checklist (₱150 utang, ₱50/₱100 payments, keyboard/scroll/save behavior, and history reload at zero). Recorded an owner-reported pass in [phone checks](hosted-phone-checks.md), with device/browser unspecified and no independent fixture inspection in this task.
- Added an isolated [pilot performance harness](pilot-performance.md) using optimized application code, 500 fictional customers and 20,000 entries, both evenly distributed and with a 4,000-entry customer history. It measures desktop and CPU-throttled mobile Chromium reads, checks reconciliation, records repeated timings and snapshot size, and blocks unexpected external requests. It never writes development Supabase or existing local demo storage.
- Added the performance run to the checked pull-request workflow. Application source, original designs, hosted deployment, schema/migrations, and existing records are preserved.
- Pilot baseline: **four performance scenarios passed functional/isolation assertions locally**, across the main run and a targeted long-history mobile run. The two-second target is **not passed**: desktop Home/day medians were 2.65–3.10 seconds; slowed mobile Home/day medians were 26.10–27.67 seconds, with a 22.58-second long-history median. Cached exact-name searches stayed below two seconds in every sample. Full results and simulation limits are in the performance guide.
- Final local validation passed: formatting (including `.github`), production build/type checking, **48 unit/PostgreSQL tests**, and **60 mobile/desktop browser regressions**. The added four performance scenarios separately passed their functional/isolation assertions as described above. Normalized Windows checkout line endings for formatting without changing tracked application content. Integration uses a checked pull request into `develop`; `main` stays at the release baseline.
- [PR #7](https://github.com/mrAsis1/Tindahan/pull/7) contains this task. Initial CI and a retry passed formatting/build/unit checks but failed before browser tests because the runner's unrelated Google Chrome APT feed returned mismatched package hashes. Added a temporary-runner step that moves that unused feed aside before installing Playwright's system dependencies and pinned Chromium. Package verification remains enabled; application dependencies and the local computer are unchanged. Require successful checks on the updated PR head before merging.
- Next: use the baseline to address pilot-volume bottlenecks and pagination, then verify hosted/device/network performance, production setup/email, backup restoration, and a small-store pilot. Phone entry confirmation does not complete these readiness gates.

## Hosted acceptance checks — 9 September 2026

- Started from current `develop` on `codex/chore/hosted-phone-checks`.
- Added a [repeatable hosted ledger and phone checklist](hosted-phone-checks.md): one clearly labeled fictional customer, ₱150 utang, ₱50/₱100 payments, search, reload persistence, and cross-device history comparison.
- After private owner sign-in, the hosted UI sequence passed at a 390×844 viewport against development Supabase: customer creation, search, ₱150 utang, ₱50 payment, reload at ₱100 remaining, ₱100 payment, and reload at zero with exactly three entries. The fictional customer **Hosted UI check 9 September 2026** remains for traceability; IDs are in the checklist. Existing records were preserved.
- Verified hosted recovery routes directly: the forgot-password form survives reload, and a reset URL without credentials shows the missing/expired-link message. At a 390×844 emulated viewport, the missing-link page has no horizontal overflow. No email was sent or password changed by these checks.
- Dashboard and Daily Record totals both increased from ₱500 to ₱650 for utang and payments; outstanding stayed zero. The history page also has no horizontal overflow at the tested viewport.
- The owner confirmed that both requested phone checks passed: the same three entries and zero balance appeared, and hosted recovery/new-password sign-in worked. Password entry and email links stayed private with the owner.
- Remaining: physical-phone transaction entry/keyboard behavior, production email setup, backup restoration, and pilot performance work. These hosted UI results are distinct from local mobile emulation with a fictional API and database concurrency tests. No application code, deployment, or schema change was needed.

## Private development hosting — 9 September 2026

- Started from current `develop` on `codex/chore/development-hosting`.
- Registered the owner-only Tindahan Development Site at `https://tindahan-development.monarchrenante27.chatgpt.site`. Added the Site manifest with Vite static output and single-page route fallback.
- Applied the Supabase Site URL and exact hosted recovery callback while preserving local reset callbacks. CLI verification reports all hosted configuration up to date. No schema migration, account recreation, or ledger changes were required.
- Added [hosting and phone-testing instructions](development-hosting.md), including the separate ChatGPT access gate, Tindahan owner login, build-time public settings, and reset-link handling.
- Privately published the validated Supabase-mode static build; Sites reports deployment succeeded. [PR #5](https://github.com/mrAsis1/Tindahan/pull/5) tracks the exact source and integration into `develop`. The implementation passed build, formatting, 46 unit/database tests, and 60 browser tests on GitHub. Hosted runtime access/sign-in on a physical phone remains the owner's next check; production email, backups, and performance remain future work.
- After publication, the owner confirmed that the notebook loads on their phone. Private access and owner sign-in therefore have a successful physical-device check. Hosted phone transaction flows and password recovery still need separate checks. The published app source is `511aa763b01e86a6697681b34555874ee1a9a9d5` (Sites version 2); this subsequent note only records the test outcome.

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
