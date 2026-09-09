# Pilot performance checks

The README proposes **500 customers and 20,000 entries**, ordinary searches and summary reads within **two seconds**, and paginated histories. This harness establishes a repeatable frontend baseline before changing data loading or rendering. A passing functional test does **not** mean the two-second target or production readiness has passed.

## Run and isolation

```sh
npm run test:performance
```

Use the repository's pinned Node/npm versions and installed Playwright Chromium. The command builds optimized application code into ignored `.local-checks/pilot/app`, then serves it on `127.0.0.1:4180`. It does not use `dist`, `.env.local`, a development Supabase account, or the hosted notebook. The Vite test configuration disables environment-file loading and fixes the fictional backend settings explicitly.

Each fresh Playwright context intercepts the fictional Auth user and notebook-read responses. Every other external request is aborted and fails the test. Financial/customer writes are not implemented by the fixture. Only a fictional Auth session is stored in the disposable browser; the test checks that `tindahan.local-demo.v1` remains absent. Do not import this dataset into a real browser notebook or Supabase.

## Dataset and measurements

- Two deterministic datasets each have 500 explicitly fictional customers and 20,000 active entries over 20 days in August 2026. Each pair has ₱150 utang then ₱50 payment, producing ₱1,000,000 outstanding. Independent unit checks validate the schema, historical balances, unique entries, and expected totals.
- The even dataset has 40 entries per customer. The concentrated variant has 4,000 entries and ₱200,000 outstanding for customer 001. Both have 1,000 entries on the tested day, 20 August, with ₱75,000 utang, ₱25,000 payments, and ₱1,000,000 closing balance.
- Desktop Chromium runs at normal CPU speed; Pixel 7 emulation uses Chromium with a fourfold CPU slowdown. Neither is a physical phone. The fixture adds 150 ms to each notebook response, without bandwidth throttling or a real database/server delay.
- Three samples measure Home reload, navigation to all customers, exact-name search after the Search screen is ready, opening customer history, and Daily Record reload. Reloads fetch the whole notebook; in-app navigation can use the existing query cache. Playwright request routing disables the browser HTTP cache, so these reloads also include local static-asset requests.
- Timings include Playwright interaction/assertion overhead and two animation frames after expected content appears. They are conservative automation durations, not browser-only paint metrics. Reports retain every sample, median, maximum, and count above two seconds. Three samples are a small baseline, insufficient for a reliable p95 claim.
- Correct customer balances, directory/history/day row counts, Home and day closing totals, expected notebook reads, absence of page errors, and network isolation must pass. Timing overruns are reported, not hidden or enforced as hardware-dependent CI failures.

The JSON runner report is `.local-checks/pilot/report.json`. Its test attachments contain the measured browser version, CPU factor, response delay, uncompressed snapshot size, read count, and timing samples. GitHub's **Build and test** job also runs the harness; its log retains the JSON measurements. Local generated reports stay ignored.

## Initial local baseline — 10 September 2026

The first attempt used five rounds and a three-minute test limit. Desktop completed, but slowed mobile exceeded the overall test limit. The final harness uses three rounds and a seven-minute limit per scenario so the slow long-history case can finish. Functional failures still fail the check, and every measured overrun remains in the report. This adjustment limits repeat-run cost and allows measurement of slow behavior; it does not relax or certify the two-second target. The complete CI job has a 20-minute limit.

Measured on the development Windows computer with Chromium 153.0.8010.12. Each cell is a three-sample median in milliseconds. These are simulated conditions, not a measured physical-phone or hosted network profile.

| Dataset / browser            | Home reload | Customer directory | Exact-name search | Customer history | Daily reload |
| ---------------------------- | ----------: | -----------------: | ----------------: | ---------------: | -----------: |
| Even / desktop               |       2,902 |                700 |                54 |               99 |        3,100 |
| Concentrated / desktop       |       2,650 |                584 |                61 |            2,325 |        2,900 |
| Even / slowed mobile         |      26,104 |              6,169 |               209 |              569 |       27,666 |
| Concentrated / slowed mobile |      26,238 |              5,603 |               341 |           22,577 |       26,240 |

The target is **not passed**. All recorded Home/day reload samples exceeded two seconds. Concentrated histories and slowed-mobile customer directories also exceeded two seconds in every sample. Cached exact-name search stayed below two seconds in every recorded sample. Snapshots are 5,893,463 and 5,886,357 uncompressed bytes respectively.

All four scenarios passed their functional and isolation assertions locally: three completed in the main run, followed by a targeted concentrated-mobile run with the larger harness timeout. Its three rounds took 4.5 minutes. These are the same application source and three-sample procedure; only the harness time budget changed. Local generated reports describe their individual invocation; CI runs all four scenarios together.

## Remaining acceptance work

The application still fetches the complete notebook and renders complete history/day lists. This harness does not add pagination, change financial calculations, verify hosted database performance, or test save latency. It also excludes correction-heavy histories and actual store-network conditions. Short fixture IDs and omitted optional/null audit fields mean a hosted notebook with the same entry count can have a larger payload.

Use the measurements to choose the next optimization, then rerun the same dataset. Before calling the pilot target passed, agree and record the physical device/browser and network profile, test a development backend at the pilot volume with clearly separated fixtures, measure saves and post-save refreshes, and verify that pagination retains complete totals and correction history. Production email, a separate production environment, a backup restoration rehearsal, and the small-store pilot remain separate readiness gates.

Source-review candidates for the next profiling task: snapshot parsing validates each entry's date through `storeNow()`, which constructs a date/time formatter; Home and customer lists scan the ledger repeatedly to derive each customer's balance; and long history/day lists render every row. These are candidates, not measured attribution of time. Preserve future-date checks, historical balances, and correction ordering while optimizing.
