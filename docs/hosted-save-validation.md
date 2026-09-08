# Hosted saves and uncertain retries

## Verified behavior

The development database serializes competing writes. Two payments of ₱80 against a ₱100 balance accept only one; the remaining balance is ₱20. Two concurrent calls with the same request ID and payload create one payment and one audit event. Repeating a committed payment after discarding its response returns the original entry, while changing its payload is rejected.

The application keeps an uncertain transaction's request ID and details while its form remains open. **Retry save** can check the original payment even if a later notebook refresh shows a zero balance. Changing the uncertain details is blocked until the owner restores them or checks history and starts a separate entry. Confirmed database validation/access failures still allow correcting the form.

If the write succeeds but the notebook refresh fails, the form remains visible with its amount and customer. Retry only refreshes the notebook, then opens the confirmation; it does not submit another write. Background refresh errors show that displayed balances may be stale instead of unmounting the form.

Retry state is in memory for the open form. This is not an offline queue or durable recovery across reload, navigation, browser closure, or sign-out. Check customer history before starting a replacement save after leaving an uncertain form. Customer creation and correction retry handling are separate existing flows; this milestone strengthens utang/payment saves.

## Repeat the checks

Normal automated checks use fictional local data or intercepted HTTP responses and require no hosted credentials:

```sh
npm run build
npm test
npm run test:e2e
```

`tests/e2e/saves.cloud.spec.ts` exercises the real app and Supabase SDK with a fictional API on port 4179. It covers a dropped request, a committed write whose response is lost, a failed post-save refresh, and two stale tabs receiving success/rejection. These are browser behavior tests, not evidence of PostgreSQL locking.

The separate hosted check deliberately writes new fictional customers to **Tindahan Development** and preserves them. Sign in to the Supabase CLI first, then run from the repository:

```sh
node tests/hosted/verify-saves.mjs --development-fixtures
```

This command is pinned to development project `bzkbndvmspnyjkuyaudr` and requires exactly one store. It uses existing CLI authentication; no database password, service-role key, or owner password is needed in source. It is not part of CI. Each successful run creates three labeled customers with zero final balances and keeps their ledger/audit history. Never use it for real store records.

The harness calls the hosted Management API through the CLI. Writes explicitly switch to the database `authenticated` role and set the existing development owner's request claim before calling the app's RPCs. A held transaction and an observed competing backend lock wait prove overlapping PostgreSQL connections. Each hold lasts 45 seconds to accommodate CLI startup latency; the check takes several minutes and should run while the owner is not entering records because writes share an owner lock.

This verifies hosted RPCs, locks, rollback, idempotency, and audit counts. It does not exercise hosted Auth token verification, the PostgREST gateway, or a real mobile radio disconnect. The discarded-response case intentionally ignores a committed result; separate intercepted browser tests verify the UI response to network failure.

Run reports and fixture IDs are saved under ignored `.local-checks/`, independently of Playwright's disposable `test-results/`. On failure, inspect the fixture IDs before retrying. The script never deletes records or silently resets the database.

## 9 September 2026 result

All three hosted checks passed in run `08815d63-c39b-4df7-bd58-996e9c93ab29`. An earlier run `27961875-6156-42cf-bfed-12c35561e906` passed competing payments but its second overlap observation missed the shorter hold window; that timing assertion was fixed by extending the hold. All five customers from both attempts were subsequently verified at zero balance:

| Fictional customer suffix and case | Customer ID                          | Ledger entries |
| ---------------------------------- | ------------------------------------ | -------------- |
| 08815d63 competing payments        | a1236880-e859-45db-ae12-b47d31ccf4d6 | 3              |
| 08815d63 duplicate requests        | 7479fa07-295e-4d99-8a8c-50a74375f9de | 2              |
| 08815d63 lost response             | 18da6dca-5c6b-4750-9125-3ae1e3d76ffc | 2              |
| 27961875 competing payments        | ed3b897f-36d9-49b1-a54b-ec7a94468855 | 3              |
| 27961875 duplicate requests        | 4e4d7683-081f-4ca5-b467-75be423424c5 | 2              |

The initial reports were placed in Playwright's disposable output directory and were cleared by the browser run. The IDs and balances above were recovered by a fresh read-only database query; future reports use `.local-checks/`. Existing setup records and migrations were preserved.

Next: a hosted development URL and phone checks, followed by production email, backup restoration, performance/pagination, and remaining release preparation.
