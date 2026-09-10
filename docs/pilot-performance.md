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
- Three samples measure Home reload, navigation to the customer directory, exact-name search after the Search screen is ready, opening customer history, and Daily Record reload. Current code fetches a screen-specific response; in-app navigation reuses only the matching view's query cache. Playwright request routing disables the browser HTTP cache, so reloads also include local static-asset requests. Following the pagination change, directory/history/day timings measure the first page of at most 50 rows; the initial baseline below rendered every row. The dataset, full-ledger totals, CPU settings, and 150 ms response delay are unchanged. Current responses are precomputed outside timed interactions using the same projection verified against SQL; timings do not measure database execution.
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

## Frontend optimization — 10 September 2026

Reused locale formatters, reused the formatted clock result only within the same epoch second, replaced repeated customer-balance scans with one ledger pass, memoized read results, and paginated customer/history/day rendering. Every clock call still checks its supplied/current instant; tests cover Manila midnight, backwards changes, and mutation of a returned result. Financial rules and stored records are unchanged.

Final local run: all four scenarios passed together, with the same Windows computer, Chromium version, fixtures, CPU factors, and response delay as the baseline. Each cell is a three-sample median in milliseconds. List timings now measure the first page, not the old all-row rendering workload; complete-ledger counts and totals are still checked.

| Dataset / browser            | Home reload | Customer directory | Exact-name search | Customer history | Daily reload |
| ---------------------------- | ----------: | -----------------: | ----------------: | ---------------: | -----------: |
| Even / desktop               |         918 |                136 |                63 |              125 |        1,380 |
| Concentrated / desktop       |       1,020 |                156 |                73 |              149 |        1,385 |
| Even / slowed mobile         |       9,859 |              3,242 |               300 |            2,048 |       11,291 |
| Concentrated / slowed mobile |      11,726 |              3,326 |               345 |            2,738 |       11,853 |

All desktop samples were below two seconds. All slowed-mobile Home/day samples still exceeded two seconds; directory/history samples also exceeded it in some or all rounds. Exact-name search remained below two seconds. Slowed-mobile samples varied substantially (Home 6,489–16,036 ms, day 4,100–12,134 ms), and short-history navigation was slower than the original baseline in this run. These small samples show useful reload and long-list gains, not a guarantee that every interaction improved. The two-second readiness target remains **not passed**.

Snapshot sizes remain unchanged at 5,893,463 and 5,886,357 uncompressed bytes. An intermediate run before same-second clock reuse also passed functional assertions but had slower mobile Home/day medians of 15–22 seconds. The final report records all samples; neither run measured hosted service or physical-device performance. Separate unit and mobile/desktop browser regressions verify full balances, older-entry corrections and retained originals across pages, filter/search/day resets, and narrow layout.

## Scoped responses — 10 September 2026

The [new read API](scoped-notebook-reads.md) returns only the entries and totals needed for the selected screen. It is locally tested and not yet installed on hosted development. The final four-scenario local run passed together with the same Chromium version, fixtures and CPU settings. Median durations in milliseconds:

| Dataset / browser            | Home reload | Customer directory | Exact-name search | Customer history | Daily reload |
| ---------------------------- | ----------: | -----------------: | ----------------: | ---------------: | -----------: |
| Even / desktop               |         462 |                344 |                58 |              301 |          498 |
| Concentrated / desktop       |         454 |                334 |                57 |              468 |          500 |
| Even / slowed mobile         |       3,466 |              3,420 |               258 |              926 |        2,019 |
| Concentrated / slowed mobile |       3,231 |              2,820 |               337 |            2,638 |        4,027 |

Home/day reload medians improved compared with the previous complete-snapshot run. Directory/history navigation now makes a separate request with its own 150 ms delay, so cached-navigation results are not the same workload as before. The final run made 12 scoped reads per scenario instead of the old six whole-notebook reads. Repeated search uses the directory cache.

| Response                              | Even dataset bytes | Concentrated dataset bytes |
| ------------------------------------- | -----------------: | -------------------------: |
| Old complete notebook, for comparison |          5,893,463 |                  5,886,357 |
| Home (three entries)                  |              1,717 |                      1,711 |
| Directory (500 customers, no entries) |            120,540 |                    120,542 |
| Customer history (40 / 4,000 entries) |             11,963 |                  1,147,787 |
| Day (1,000 entries)                   |            384,950 |                    384,765 |

These are uncompressed fictional JSON response sizes, excluding static assets and HTTP overhead. Home is more than 99.9% smaller. The harness rejects `get_notebook()` on all measured routes and enforces response-size limits, while retaining full-total assertions. A separate real-SQL test seeds a disposable 500-customer/20,000-entry database, checks totals and reduced response sizes, and does not claim hosted timings.

The two-second target remains **not passed**: all desktop samples passed, but slowed-mobile Home/day/directory/history still had overruns. Home ranged from 964–7,264 ms and day from 1,871–5,365 ms. Search remained below two seconds. Remaining startup, individual history/day loading, real network/server latency and save performance need separate measurement.

## Deferred form code and startup profiling — 10 September 2026

An optimized-build module inspection found React Hook Form and all form/correction/confirmation screens in the initial JavaScript. Those routes now load through dynamic imports, with an accessible loading state and a manual recovery path for failed downloads. The primary reading screens and authentication initialization remain eager. Deferred code is downloaded on first use, so this reduces startup work rather than removing the code entirely; the first form visit makes additional asset requests.

The browser measured **641,414 bytes before and 596,830 bytes after** for Home's initial JavaScript: **44,584 fewer decoded bytes (6.95%)**. Build gzip estimates changed from about 187 KB to 172 KB. These are JavaScript sizes, separate from the unchanged roughly 1.7 KB Home notebook response. The main bundle remains above Vite's 500 KB advisory; framework/authentication/read-validation dependencies still form most of it.

The pilot report now records initial script URLs/decoded sizes/response completion, DOM interactive time and first contentful paint for each Home sample. A missing paint entry is reported as null. First paint may show a loading screen and does not mean the notebook is ready. Source-module rendered sizes were used to locate candidates; they are not additive final minified-byte measurements.

The same-session desktop even-dataset baseline measured Home median 501 ms and first-paint median 176 ms; after deferral these were 483 ms and 168 ms. Three samples do not establish a meaningful timing improvement. The final full run retained the same fixtures, 150 ms API delay, browser version and CPU settings. Median notebook-ready durations in milliseconds:

| Dataset / browser            | Home reload | Customer directory | Exact-name search | Customer history | Daily reload |
| ---------------------------- | ----------: | -----------------: | ----------------: | ---------------: | -----------: |
| Even / desktop               |         483 |                356 |                67 |              312 |          469 |
| Concentrated / desktop       |         465 |                331 |                63 |              436 |          504 |
| Even / slowed mobile         |       3,378 |              2,244 |               338 |            2,183 |        4,684 |
| Concentrated / slowed mobile |       3,730 |              2,212 |               316 |            4,166 |        4,519 |

All four scenarios passed correctness/isolation checks. Desktop samples and exact-name searches stayed below two seconds. Slowed-mobile Home/day samples all exceeded it; history/directory still had overruns. Slowed-mobile first paint ranged from 1,200–3,992 ms despite script responses completing within 161–349 ms. This identifies a remaining interval to profile; it does not isolate a specific CPU, rendering, authentication or scheduling cause. The two-second target remains **not passed**, and mobile timings do not show a consistent gain over PR #9. The verified improvement is the smaller startup download.

Four additional optimized-build checks (mobile and desktop, without CPU throttling) verify that Home requests no form chunks, initial JavaScript stays below a 620 KB regression budget, forms become interactive on demand/direct reload, and a deliberately blocked form chunk recovers after manual reload. These are behavioral/asset checks, not additional pilot timing scenarios. They share the isolated server and fictional API, reject unexpected external requests, and verify that local demo storage remains absent. `npm run test:performance` runs all eight checks; the existing complete browser suite separately covers actual save/retry/correction/recovery flows.

No frontend was published and no database change was made for this task. The earlier scoped-read migration remains pending; publish its matching frontend only after that migration is reviewed/applied when rollout resumes. Publish the complete static build, including its hashed page chunks. An older tab unable to fetch a page chunk gets a manual reload option; there is no automatic reload that could discard a draft.

## Remaining acceptance work

Read screens now fetch scoped data. Forms and confirmations still fetch the complete notebook; customer histories and days still fetch every entry in their selected scope before displaying 50-row pages. Totals use the full relevant ledger. The harness does not verify hosted database performance or save latency. It also excludes correction-heavy performance datasets and actual store-network conditions. Separate SQL and browser tests cover correction chains and page boundaries. Short fixture IDs and omitted optional/null audit fields mean a hosted response can be larger.

Use the measurements to choose the next optimization, then rerun the same dataset. Before calling the pilot target passed, agree and record the physical device/browser and network profile, test a development backend at the pilot volume with clearly separated fixtures, measure saves and post-save refreshes, and verify that pagination retains complete totals and correction history. Production email, a separate production environment, a backup restoration rehearsal, and the small-store pilot remain separate readiness gates.

The frontend optimization reuses date/currency formatters while reading the current clock on each validation, calculates customer balances in one pass, and pages long lists. Future-date checks, historical balances, and correction ordering remain covered by regression tests. Further loading changes must preserve these guarantees and the separation between local demo storage and Supabase.
