# Supabase setup for Tindahan

## Current development project

Project: **Tindahan Development**, reference `bzkbndvmspnyjkuyaudr`.

The initial migration was applied through the project's SQL Editor on 6 September 2026 after verifying that its public schema had no existing tables. All five tables were checked afterward: row-level security enabled, anonymous reads denied, direct authenticated inserts denied. The application uses explicit RPCs for writes.

This computer's ignored `.env.local` selects this project using its public project URL and publishable key. No database password, secret key, service-role key, or owner password is stored in the repository. A Supabase dashboard account and a Tindahan owner login are separate accounts.

## Finish your owner login

The owner account on this development project has already been created and signed in successfully. Its **Tindahan** notebook is created. The hosted customer/utang/payment check passed, including persistence after reload. **Demo Customer (setup check)** remains with three fictional entries (₱150 utang, ₱50 payment, ₱100 payment) and a final zero balance. Steps 1–4 below are for initial setup on a new project; do not recreate the existing account or notebook.

1. In [Authentication → Users](https://supabase.com/dashboard/project/bzkbndvmspnyjkuyaudr/auth/users), choose **Add user → Create new user**.
2. Enter your owner email and a password yourself. For this manually created development account, leave **Auto confirm user** checked. This form does not send an invitation email.
3. Open [Tindahan locally](http://127.0.0.1:5173) and sign in with that owner email/password.
4. Name your store and select **Create notebook**. This creates one store for your account, starting empty at ₱0.00.
5. Add a fictional customer, record ₱150 utang, then record a ₱50 payment. The balance should be ₱100. Refresh, sign out, and sign back in to verify persistence.

Keep using fictional records during this development setup. The local demo's records remain in browser storage and are not automatically imported into Supabase.

## Configuration on another computer

Copy `.env.example` to `.env.local` and fill in:

```dotenv
VITE_DATA_BACKEND=supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

Get these public values from the project's **Connect** dialog or **Settings → API Keys**. Never put an `sb_secret_` or `service_role` key in a `VITE_` variable; Vite publishes those variables in the browser bundle. The current app accepts hosted Supabase project URLs and publishable keys.

```sh
npm ci
npm run dev
```

Restart Vite after changing environment settings. A missing or invalid Supabase configuration shows an error; it never silently switches financial writes to local storage.

To revisit the original fictional demo, change `VITE_DATA_BACKEND=local` and restart. Cloud mode has **Sign out**; only local mode exposes **Reset demo**. Supabase Auth persists the login session in browser storage, but financial records in cloud mode are stored in the hosted database.

## Authentication settings

For this owner-only development app, use email/password and keep public user registration disabled in Supabase **Authentication → Sign In / Providers → User Signups**. Manually create the owner through the dashboard as described above. The initial SQL migration does not change hosted Auth settings.

For the configured development project, public signup has been disabled through the dashboard. Its Site URL is saved as `http://127.0.0.1:5173`, with `http://localhost:5173` also saved in the redirect allow list.

Set **Authentication → URL Configuration → Site URL** to `http://127.0.0.1:5173` during development. If using both hostnames, add `http://localhost:5173` as a redirect URL. Update these URLs when deploying. Password recovery, public signup, invitation delivery, and custom SMTP are not implemented in the app yet.

`supabase/config.toml` is local CLI configuration; it does not automatically update hosted Auth settings. Docker is required for a full local Supabase stack. It was not available during this setup, so automated SQL tests use embedded PostgreSQL instead.

## Migrations and future changes

Source of truth: `supabase/migrations/20260906090000_create_tindahan.sql`.

For a **different, new empty project**, apply that complete file once through SQL Editor or use the authenticated CLI. It contains a transaction, so a SQL error rolls back the migration. Do not rerun it on the configured development project: its tables already exist.

The initial migration was applied in SQL Editor on 6 September and registered in CLI history on 7 September 2026. This checkout is now linked to the development project. Both local and remote histories show `20260906090000`; `db push --dry-run` reports the database is up to date. The repair only registered history; it did not rerun the schema or alter customer/ledger records.

On 7 September, the CLI also applied `20260907090000_audited_corrections.sql`. Both versions now match local and hosted history, with no pending migrations. The hosted correction check preserved two voided utang versions and an active replacement on the fictional setup customer, whose current balance remains zero. See [corrections](corrections.md) for how to use the flow.

On another computer, sign in and link the checkout, then verify history:

```sh
npx supabase login
npx supabase link --project-ref bzkbndvmspnyjkuyaudr
npx supabase migration list --linked
npx supabase db push --dry-run
```

If interactive login reports JSON-output errors when launched by an agent, use `npx supabase login --agent no --output-format text`. Keep access tokens and database passwords private; the CLI stores authentication outside the repository, and project link metadata under `supabase/.temp` is ignored by Git.

The one-time repair used on this project was `npx supabase migration repair 20260906090000 --status applied --linked`. Do not repeat it as a routine setup step. For other manually applied migrations, repair history only after verifying the corresponding schema really exists. See the [official CLI reference](https://supabase.com/docs/reference/cli/getting-started) for the distinction between history repair and applying SQL.

For later changes, create a new migration file, test it, inspect `npx supabase db push --dry-run`, then push to the intended development project. Never use a remote database reset as an ordinary migration step.

Follow [the branch workflow](branching.md) for database changes too. Switching Git branches does not switch hosted projects. GitHub checks use local fictional data and do not perform hosted migrations.

## What the backend enforces

- One store per owner; all reads are scoped to the authenticated owner.
- Customer/store composite references prevent cross-store ledger entries.
- Positive integer centavos, bounded amounts, valid dates, and description limits.
- Transactions serialize writes for each owner and explicitly lock the customer row.
- Stable request IDs return the original result on a matching retry and reject conflicting payloads.
- A payment cannot make any chronological running balance negative, including after backdating.
- Successful writes and audit events commit together. Browser roles cannot directly insert, edit, or delete ledger/audit rows.
- `get_notebook` returns the store, customers, and entries together in a consistent snapshot.

Creation and audited void/replacement corrections are implemented. See [correction behavior and rollout](corrections.md) for the new migration and atomic ledger validation. Opening-balance import UI, pagination, backup restoration checks, and a production readiness review remain future work. The full snapshot is deliberately simple for the small development dataset; it is not the final large-ledger pagination strategy.

## Checks

```sh
npm run build
npm test
npm run test:e2e
npm run format:check
```

SQL tests run the actual migration, PostgreSQL roles/RLS, and RPC functions through PGlite. They stub only Supabase's `auth.users` and `auth.uid()` contract. These tests do not replace hosted Auth, network failure, or real multi-connection concurrency tests.

Browser regression tests force local demo mode on port **4178**, so they do not reset or alter your cloud notebook. Hosted checks require an owner to sign in interactively.

Official references: [React Auth](https://supabase.com/docs/guides/auth/quickstarts/react), [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [database functions](https://supabase.com/docs/guides/database/functions), [migration workflow](https://supabase.com/docs/guides/local-development/database-migrations).
