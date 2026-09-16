# Tindahan

A mobile-first customer debt and payment tracker for sari-sari stores and small retailers. Tindahan replaces a paper utang notebook with searchable customers, clear balances, and an auditable transaction history.

**Utang** means money a customer owes for purchases made on credit.

## Features

- **Dashboard:** total outstanding debt, today's summary, and recent activity.
- **Customer directory:** search customers and use contact details or notes to distinguish similar names.
- **Utang and payments:** select an existing customer from a searchable list, record purchases, and accept partial or full payments.
- **Customer management:** edit details, retain before/after change history, and soft-delete or restore customers without erasing balances or transactions.
- **Daily records:** browse transactions and totals for a selected date.
- **Transaction corrections:** void an incorrect entry with a reason and optionally replace it while retaining the original record.
- **Owner sign-in:** Supabase authentication, password visibility control, and password recovery.
- **Responsive interface:** grouped lists, pagination, and layouts for phones and desktops.

## Technology

React, TypeScript, Vite, and Tailwind CSS, with React Hook Form and Zod for forms and validation. Supabase provides authentication and PostgreSQL storage. Tests use Vitest, PGlite, and Playwright.

## Run locally

Use **Node.js 24.18.0** and **npm 11.16.0**, as recorded in `.nvmrc` and `package.json`.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. A fresh checkout runs the fictional local demo without cloud credentials. If an existing `.env.local` selects Supabase, change `VITE_DATA_BACKEND` to `local` to use the demo.

The demo stores data only in the current browser. It includes six fictional customers; select **5 September 2026** in Daily Record to explore the sample transactions. Demo data is not synchronized or backed up.

## Use your own Supabase project

1. Copy `.env.example` to `.env.local`.
2. Set your project's frontend connection values:

   ```dotenv
   VITE_DATA_BACKEND=supabase
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
   ```

3. Apply the migrations in `supabase/migrations/` in timestamp order to your intended project. An existing database must receive only migrations it has not already applied.
4. Create an owner account, configure the app URL and password-recovery redirects, then sign in and create a notebook.
5. Verify the setup with fictional records before entering real store data.

See [Supabase setup](docs/supabase-setup.md) and [account recovery](docs/account-recovery.md) for details. Development project references in those documents describe this repository's setup history; use your own project settings.

**Never put a database password, secret key, or service-role key in a `VITE_` variable.** Frontend environment values are included in the browser bundle. Keep `.env.local` out of Git; only the blank `.env.example` is tracked.

## Data integrity

Amounts are stored as integer centavos. Supabase access is scoped to the signed-in owner through row-level security. Database functions validate writes, prevent overpayments, and support retrying uncertain saves without recording the same request twice. Customer deletion flags and transaction corrections preserve history.

The local demo has no authentication. It is intended for trying the interface, not storing private customer records on a shared device.

## Development checks

```sh
npm run format:check
npm run build
npm test
npx playwright install chromium
npm run test:e2e
npm run test:performance
```

`npm run check` runs the build, unit/database tests, and browser tests. Performance tests use fictional data and simulated conditions; they do not measure a live Supabase deployment.

## Project structure

| Directory              | Contents                                                              |
| ---------------------- | --------------------------------------------------------------------- |
| `src/features/`        | Dashboard, customers, transactions, daily records, and authentication |
| `src/components/`      | Shared interface components                                           |
| `src/lib/`             | Money and ledger rules, validation, and storage repositories          |
| `supabase/migrations/` | Database schema, access policies, and write functions                 |
| `tests/`               | Unit, database, browser, and performance checks                       |
| `docs/`                | Setup, workflows, verification records, and deployment notes          |
| `design/`              | Original interface references                                         |

## Documentation and deployment

- [Customer editing and recoverable deletion](docs/customer-changes.md)
- [Transaction corrections](docs/corrections.md)
- [Branch and release workflow](docs/branching.md)
- [Vercel setup](docs/vercel-testing.md)
- [Production readiness](docs/production-readiness.md)
- [Backup and restoration](docs/backup-restoration.md)
- [Public repository review](docs/public-repository-review.md)
- [Development history](docs/progress.md)

The repository includes Vercel configuration for a Vite single-page application. A push to `main` is a source release; it does not by itself prove that hosting, database migrations, email delivery, or backups are configured. Review the deployment guides for the intended environment.

## License

No project license has been selected. A license can be added separately when the owner chooses how the source may be reused.
