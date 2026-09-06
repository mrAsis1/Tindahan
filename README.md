# Tindahan — Customer Utang Tracking Management Information System

> **Implementation milestone 1 is now available:** a React + TypeScript + Vite application with working customer, utang, payment, history, and daily-record flows. It uses **temporary browser localStorage with fictional data**, not Supabase. The specification below remains the production roadmap; authentication, cloud persistence, and production financial writes are still planned. See [completed work and next steps](docs/progress.md).

## Run the application

Use **Node.js 24.18.0** and **npm 11.16.0** (versions are recorded in `.nvmrc` and `package.json`). From this repository:

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. No environment variables, account, or database are needed for this milestone. Use the same address each time: browser storage is scoped to the origin, so `localhost` and `127.0.0.1` have separate demo notebooks.

```sh
npm run build              # Type-check and build to dist/
npm run preview            # Preview the built app
npm test                   # Money, ledger, validation, and local repository tests
npx playwright install chromium  # One-time browser download
npm run test:e2e            # Both flows and edge cases, mobile + desktop Chromium
npm run check              # Build and run both test suites
npm run format:check       # Check consistent source formatting
```

The seed has six fictional customers and **₱4,850.00** outstanding. Maria Santos starts at **₱850.00**. In Daily Record, choose **5 September 2026** to see **₱650.00** new utang and **₱400.00** payments. New transactions default to the actual current date in `Asia/Manila`, so today's summary may initially be empty. The **Reset demo** control can restore the examples or start an empty notebook after confirmation.

Changes survive refresh in this browser until its storage is cleared or the demo is reset. They are not backed up, authenticated, or synchronized to another device. Use fictional records only. The original standalone references remain unchanged in [`design/`](design/).

---

A mobile-first system for sari-sari stores and small retail stores that records customer debts (utang), tracks payments, and keeps an organized digital transaction history in place of a paper notebook.

**Document type:** Project specification and development plan  
**Version:** 1.0 — Draft  
**Development approach:** Solo project — designed, developed, tested, and maintained by you  
**Project repository:** To be created

This document describes the intended Tindahan system. The core features come from the project requirements; implementation choices and additional operating rules are proposed defaults. They do not imply that a production application or backend has already been built.

## Table of Contents

1. [Overview](#1-overview)
2. [Solo Development Responsibilities](#2-solo-development-responsibilities)
3. [Tech Stack](#3-tech-stack)
4. [Getting Started](#4-getting-started)
5. [Project Structure](#5-project-structure)
6. [Domain Rules & Business Logic](#6-domain-rules--business-logic)
7. [Data Model Reference](#7-data-model-reference)
8. [UI/UX Sitemap & Features](#8-uiux-sitemap--features)
9. [Design Details](#9-design-details)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Out of Scope](#11-out-of-scope)
12. [Assumptions & Decisions Log](#12-assumptions--decisions-log)
13. [Personal Development Workflow](#13-personal-development-workflow)
14. [Deployment](#14-deployment)
15. [Ownership & License](#15-ownership--license)
16. [Glossary](#16-glossary)
17. [Open Questions & Risks](#17-open-questions--risks)

---

## 1. Overview

Tindahan helps a small store owner answer three everyday questions: **Who still owes money? How much do they owe? What happened today?**

In a paper notebook, a customer’s purchases and partial payments may be written on different pages. Finding a balance requires searching entries and adding or subtracting amounts by hand. Missing notes, unclear handwriting, and repeated calculations make the record harder to maintain.

Tindahan keeps each customer’s utang and payment entries together. The owner selects a customer, enters an amount, and saves the transaction. The system calculates the new balance and updates the customer history, daily record, and dashboard.

### Objectives

- Replace handwritten utang records with searchable customer histories.
- Calculate outstanding balances from recorded transactions.
- Make adding utang and recording payments quick enough for a busy store counter.
- Summarize new utang and payments for a selected day.
- Preserve a clear record of partial and full payments.
- Provide a simple interface for an owner with limited technical experience.

### Intended Users

| User | Responsibility / access |
|---|---|
| Store owner | Maintains customer records, records utang and payments, and reviews balances and daily activity. |
| Customer | The person whose debt is recorded; no customer account or app access is included in the initial scope. |

**Proposed v1 scope:** One store per owner account, with the owner as the only operational user. Staff accounts and additional branches can be considered later.

---

## 2. Solo Development Responsibilities

Tindahan is an individual project. You handle planning, design, implementation, testing, documentation, and maintenance. The areas below organize your work into manageable stages; they are not separate positions to fill.

| Area | Your work |
|---|---|
| Planning | Set the scope, choose priorities, and track progress with a personal checklist. |
| UI/UX design | Create mobile screens, reusable controls, and prototype flows. |
| Frontend | Build navigation, forms, customer views, and accessible interactions. |
| Backend and database | Implement storage, authentication, transaction rules, and recovery. |
| Testing | Verify balances, test complete workflows, and check usability. |
| Documentation and maintenance | Maintain setup notes, a short user guide, backups, and release notes. |

---

## 3. Tech Stack

The following is a **proposed implementation stack**, subject to your familiarity with the tools, available time, and project constraints. Package versions should be chosen and pinned during setup.

| Layer | Proposed choice | Purpose |
|---|---|---|
| Design and prototyping | Figma | Editable mobile screens and connected interaction flows. |
| Application delivery | Mobile-first web application | A phone-friendly interface accessible through a browser. |
| Frontend | React with Vite | Screen composition and application build. |
| Language | TypeScript | Shared types and clearer data handling. |
| Navigation | React Router | Home, daily record, search, customers, and forms. |
| Server data | TanStack Query | Fetching, loading states, and refreshing affected views after saves. |
| Forms and validation | React Hook Form with Zod | Required fields, amount validation, and useful error messages. |
| Styling | Tailwind CSS with shared UI components | Consistent typography, colors, spacing, and tap targets. |
| Backend and database | Supabase with PostgreSQL | Persistent records and authenticated data access. |
| Authentication | Supabase Auth; sign-in method to be confirmed | Owner account and session management. |
| Financial writes | Transactional PostgreSQL functions | Consistent balance checks, duplicate prevention, and audit writes. |
| Testing | Vitest and Playwright | Calculation tests and end-to-end user flows. |
| Source control | Git and GitHub | Version history, backups of source code, and optional personal issue tracking. |
| Deployment | Static frontend host and hosted database | Separate staging and production environments. |

The current standalone preview uses browser-session data. The proposed production stack introduces persistent storage and authentication; those capabilities are not present in the preview.

---

## 4. Getting Started

### Existing Design Materials

- `tindahan-prototype.html` — standalone clickable preview using fictional records.
- `tindahan-screens.svg` — editable screen artwork for import into Figma.
- [Tindahan Figma file](https://www.figma.com/design/2vMuyrygWKheCvyQt2480z) — 22 populated mobile screens and example states with connected payment, utang, calendar, and new-customer flows. The prototype uses prepared example values.

Open the HTML file in a browser to review the full example flows. Refreshing the page or selecting **Reset demo** restores the starting records. Do not use the demo to maintain real store balances.

### Proposed Development Setup

Once the production repository is created:

1. Install the runtime and package-manager versions pinned by the project.
2. Install the repository dependencies using its committed lockfile.
3. Configure a development database and owner authentication.
4. Apply the database migrations and load fictional seed records.
5. Configure the public backend connection settings for the frontend.
6. Start the development server and run the verification suite.

Exact installation commands belong in the repository README after its scripts exist. This specification does not assume those commands have already been implemented.

### Configuration

| Setting | Location | Handling |
|---|---|---|
| Backend URL | Frontend environment configuration | Public connection information. |
| Publishable client key | Frontend environment configuration | Used with authenticated access policies. |
| Privileged credentials | Protected server / deployment configuration | Never included in the browser bundle or committed to Git. |
| Store timezone | Store record | Proposed default: `Asia/Manila`. |
| Currency | Store record | Philippine peso, displayed as `₱`. |

### Seed Data

Use fictional customers with unpaid, partially paid, and fully paid balances. Include transactions on more than one day, customers without contact numbers, and customers with similar names.

The reference demo contains six customers and a combined outstanding balance of **₱4,850.00**. On **5 September 2026**, new utang totals **₱650.00** and payments total **₱400.00**. These dates are fixed examples; the production application must use the actual current date in the store’s timezone.

---

## 5. Project Structure

Proposed repository organization:

```text
tindahan/
  src/
    app/                  # Application entry, providers, and navigation
    features/
      dashboard/          # Overall balance and recent activity
      daily-record/       # Date selection and daily totals
      customers/          # Customer search, list, profile, and history
      transactions/       # Add utang, payment, and confirmation screens
      auth/               # Owner sign-in and session handling
    components/
      ui/                 # Buttons, fields, cards, dialogs, and navigation
    lib/
      api/                # Backend operations and error handling
      validation/         # Form and request validation
      money/              # Centavo conversion and currency formatting
      dates/              # Store-local dates and display formatting
    types/                # Customer, transaction, and summary types
  supabase/
    migrations/           # Schema, constraints, policies, and write functions
    seed.sql              # Fictional test data
  tests/
    unit/                 # Balance calculations and validation
    e2e/                  # Complete owner workflows
  design/                 # Screen references and prototype notes
  docs/                   # Setup, operating rules, and user guide
  .github/workflows/      # Automated checks and deployment
```

This is a planned structure, not an inventory of the current prototype files.

---

## 6. Domain Rules & Business Logic

### Customer Records

- A customer name is required; a contact number is optional.
- Each customer has a unique internal ID. Names are display labels, not identifiers.
- Similar or identical names are allowed. The interface should show the contact number or a short distinguishing note where available.
- Search ignores letter case and surrounding spaces.
- A customer starts with a zero balance unless an explicit opening-balance entry is recorded.

### Adding Utang

The owner selects an existing customer or creates one, enters an amount, optionally records the items or notes, and chooses a date that defaults to today.

The amount must be greater than zero and must use no more than two decimal places. Saving increases the selected customer’s balance. A successful save returns the recorded transaction and updated balance.

### Recording Payments

The owner selects a customer, enters a payment amount, and selects the payment date.

- A partial payment reduces the balance without closing the customer record.
- A full payment reduces the balance to zero.
- **Proposed v1 rule:** Payments cannot exceed the balance. Customer deposits and store credit are outside the initial scope.
- The form previews the remaining balance, but the backend rechecks the amount before saving.
- A customer with no outstanding balance cannot receive a debt payment.

### Balance Calculation

All stored money amounts use **integer centavos**. For example, ₱150.25 is stored as `15025`. This avoids using binary floating-point arithmetic for stored ledger calculations.

```text
Customer balance
  = active opening-balance entries
  + active utang entries
  − active payment entries

Total outstanding utang
  = sum of all customer balances for the store

Daily net change
  = utang given that day − payments collected that day

End-of-day outstanding
  = opening outstanding that day
  + opening-balance entries effective that day
  + daily utang − daily payments
```

Opening balances represent debts transferred from the old notebook. They appear separately in daily summaries and must not inflate the day’s new utang figure.

### Running Balance and Dates

Each history entry shows the balance immediately after that entry. Calculate this chronologically, even when the screen displays the newest entry first.

Store the transaction’s effective local date and time separately from the time it was entered into the system. Use a deterministic order: effective date, effective time, creation time, then transaction ID.

Backdated entries recalculate affected historical summaries and running balances. A backdated payment must not create a negative balance at its position in the ledger or later in the resulting timeline. Future-dated transactions are excluded from the proposed v1 scope.

### Daily Record

The selected day includes every active transaction effective on that local calendar day. Display customer name, description when present, transaction type, amount, and time.

“Running total” means the store’s outstanding customer debt as of the selected day’s end. It is not sales revenue, profit, or cash in the till.

### Save Integrity

- Disable repeated submission while a save is pending.
- Give each save attempt a stable request ID so retrying an uncertain response does not create another transaction.
- Validate and save the transaction atomically on the backend.
- Serialize writes affecting the same customer so concurrent payments cannot both spend the same remaining balance.
- Show confirmation only after the backend confirms the write.

### Corrections — Proposed Production Rule

Preserve the original transaction rather than silently overwriting or deleting it. An owner may void an incorrect entry with a reason and, where necessary, create a replacement in one atomic operation. The original remains visible as **Voided** and is excluded from balance calculations.

Recheck the resulting ledger when correcting an entry. Reject a correction that would create a negative running balance. Correction screens are a production extension and are not part of the two required prototype flows.

---

## 7. Data Model Reference

The schema below is an implementation starting point. Balance values and daily summaries are derived from the ledger rather than independently editable fields.

### Entities

| Entity | Purpose |
|---|---|
| OwnerProfile | Identifies the authenticated store owner. |
| Store | Stores the owner relationship, store name, currency, and timezone. |
| Customer | Stores customer identity and optional contact information. |
| LedgerEntry | Records an opening balance, utang, or payment. |
| AuditEvent | Records creation and correction events for traceability. |

### OwnerProfile and Store

| Entity / field | Type | Notes |
|---|---|---|
| `OwnerProfile.id` | UUID, primary key | References the authenticated user. |
| `OwnerProfile.display_name` | Text | Owner’s display name. |
| `Store.id` | UUID, primary key | Unique store identifier. |
| `Store.owner_id` | UUID, foreign key | Owner of the store; unique for the proposed one-store-per-owner scope. |
| `Store.name` | Text | Store name. |
| `Store.currency` | Text | Fixed to `PHP` in v1. |
| `Store.timezone` | Text | Default `Asia/Manila`. |
| `created_at`, `updated_at` | Timestamp | System-maintained timestamps on both entities. |

### Customer

| Field | Type | Notes |
|---|---|---|
| `id` | UUID, primary key | Customer identity independent of name. |
| `store_id` | UUID, foreign key | Store that owns the record. |
| `name` | Text, required | Customer name. |
| `contact_number` | Text, nullable | Optional; preserve leading zeroes. |
| `identifying_note` | Text, nullable | Optional short note to distinguish similar names. |
| `created_at`, `updated_at` | Timestamp | System-maintained. |

### LedgerEntry

| Field | Type | Notes |
|---|---|---|
| `id` | UUID, primary key | Unique entry. |
| `store_id` | UUID, foreign key | Owning store. |
| `customer_id` | UUID, foreign key | Customer belonging to the same store. |
| `type` | Enum | `opening_balance`, `utang`, or `payment`. |
| `amount_centavos` | Positive integer | Sign is determined by entry type. |
| `description` | Text, nullable | Items, notes, or migration explanation. |
| `effective_date` | Date | Store-local transaction date. |
| `effective_time` | Time | Store-local time; use a documented default if an old time is unknown. |
| `status` | Enum | `active` or `voided`. |
| `request_id` | UUID | Unique per store; used for idempotent retries. |
| `created_by` | UUID, foreign key | Owner who recorded the entry. |
| `created_at` | Timestamp | Actual system creation time. |
| `voided_at`, `voided_by` | Timestamp / UUID, nullable | Filled when corrected. |
| `void_reason` | Text, nullable | Required for voiding. |
| `replaces_entry_id` | UUID, nullable | Links a replacement to its original. |

### AuditEvent

| Field | Type | Notes |
|---|---|---|
| `id` | UUID, primary key | Event identifier. |
| `store_id` | UUID, foreign key | Scope for authorized access. |
| `actor_id` | UUID, foreign key | Owner responsible for the action. |
| `entry_id` | UUID, foreign key, nullable | Relevant ledger entry. |
| `action` | Text | For example, `entry.created` or `entry.voided`. |
| `reason` | Text, nullable | Correction reason where applicable. |
| `created_at` | Timestamp | Event time. |

### Relationships and Constraints

- One owner has one store in the proposed v1 scope.
- One store has many customers and ledger entries.
- One customer has many ledger entries.
- A ledger entry can have multiple audit events.
- Enforce the customer/store relationship with a composite foreign key or equivalent database constraint.
- Index customer searches by store and normalized name; index ledger reads by store, customer, and effective date.
- Reject zero or negative stored amounts, unauthorized store references, and duplicate request IDs with conflicting payloads.

---

## 8. UI/UX Sitemap & Features

### Bottom Navigation

**Home · Daily Record · Search · Customers**

Search is the fast name-lookup screen. Customers is the complete customer directory and the entry point for maintaining customer records.

| Screen / proposed route | Features |
|---|---|
| Home — `/home` | Total outstanding utang, today’s new utang and payments, Add Utang and Add Payment shortcuts, recent activity. |
| Daily Record — `/daily-record` | Today’s transactions, calendar picker, previous-day records, daily totals, and outstanding balance as of the selected day. |
| Search — `/search` | Name search, customer balance results, no-results state, and access to history. |
| Customers — `/customers` | Full customer list, balances, and Add Customer action. |
| Customer Detail — `/customers/:id` | Name, optional contact, current balance, all utang and payments, running balances, and customer-specific actions. |
| Add Utang — `/utang/new` | Customer selection or creation, amount, optional description, date defaulting to today, and Save. |
| Add Payment — `/payments/new` | Customer selection, current balance, payment amount, date, remaining-balance preview, and Save. |
| Confirmation — `/transactions/:id/confirmation` | Saved amount, customer, date, previous balance, new balance, and links to Home or customer history. |
| Add Customer — `/customers/new` | Required name and optional contact details; returns to the originating flow. |

The date picker and customer picker can be dialogs or separate frames. They should preserve entered form values when dismissed.

### Required Clickable Flows

**Record a payment**

1. Open Home and tap Search.
2. Search for a customer and open their history.
3. Tap Record Payment.
4. Enter an amount and save.
5. Show confirmation and the updated customer balance.

**Add utang**

1. Open Home and tap Add Utang.
2. Select or add a customer.
3. Enter the amount and optional description; check the date.
4. Save and show confirmation.
5. Return to Home or the customer’s updated history.

### Essential Interface States

Include an empty store, no search results, no transactions for a day, a fully paid customer, loading indicators, invalid amounts, failed saves, and successful confirmations. Preserve entered values after a failed save so the owner can retry.

---

## 9. Design Details

### Visual Direction

Tindahan should feel like a clear, dependable store notebook. Use short labels, visible amounts, generous spacing, and familiar words such as **Utang**, **Payment**, and **Balance**.

| Element | Design direction |
|---|---|
| Background | Warm off-white to separate the page from white cards. |
| Primary text | Dark green-charcoal for strong readability. |
| Utang | Orange amounts with an explicit “Utang” label and plus sign. |
| Payments | Green amounts with a “Payment” label and minus sign in the ledger. |
| Typography | Clear sans-serif; approximately 16 px for primary body text and larger figures for balances. |
| Touch controls | At least 44 × 44 px; primary buttons approximately 54 px high. |
| Navigation | Persistent labeled bottom tabs on main browsing screens. |
| Forms | One column, visible labels, numeric keypad for amounts, and optional fields clearly marked. |
| History | Newest first; dates, descriptions, amounts, and running balances remain readable. |

Color reinforces the transaction type; text and signs communicate the same meaning. Long lists scroll above the navigation. Form controls and save actions must remain reachable when the keyboard is open.

### Data Access and Saving

The frontend requests customer records and summaries from the authenticated backend. Database access policies limit every operation to the owner’s store.

Financial writes go through one controlled transaction routine. That routine verifies ownership, checks the request ID, locks the affected customer, validates the resulting ledger, writes the entry and audit event, and returns the committed balance. Do not rely on a sequence of separate browser requests to provide atomicity.

Direct writes to financial tables must be restricted so they cannot bypass these rules. Following a successful save, refresh the affected customer, history, daily summary, and Home totals.

### Proposed Application Operations

| Operation | Input | Result |
|---|---|---|
| `getDashboard` | Store context and current local date | Outstanding total, today’s summary, and recent activity. |
| `getDailyRecord` | Selected date and pagination | Transactions and end-of-day totals. |
| `searchCustomers` | Search text and pagination | Matching customers and balances. |
| `getCustomerHistory` | Customer ID and pagination | Profile, balance, and ledger history. |
| `createCustomer` | Name and optional contact details | Created customer. |
| `recordUtang` | Customer, amount, description, effective date/time, request ID | Saved entry and updated balance. |
| `recordPayment` | Customer, amount, effective date/time, request ID | Saved entry and updated balance. |
| `correctEntry` | Original entry, reason, optional replacement, request ID | Atomic correction and recalculated balance. |

### Error Messages

Use actionable messages such as “Enter an amount greater than zero,” “Payment is higher than the remaining balance,” and “Couldn’t save. Your details are still here—try again.”

If a request times out after it may have reached the server, resolve the original request ID before reporting failure or resubmitting. An uncertain result must not become a duplicate debt.

### Bringing in the Paper Notebook

For each existing customer, verify the unpaid total and record it as an opening balance on an agreed migration date. Do not also enter the old purchases and payments that produced that same balance; doing both would double-count the debt.

Alternatively, enter the complete historical ledger without an opening balance. Record which approach was used for each customer and reconcile the combined balance against the paper notebook before switching over.

---

## 10. Non-Functional Requirements

These are proposed acceptance targets, not claims about a completed deployment.

| Area | Requirement |
|---|---|
| Usability | An owner can find a customer and record a normal transaction without training on technical terms. |
| Accuracy | Ledger, customer totals, daily summaries, and Home totals reconcile to the centavo. |
| Reliability | Repeated taps and retries cannot create duplicate entries. |
| Persistence | Confirmed production transactions survive refresh, logout, and device restart. |
| Privacy | Only the authorized owner can access the store’s customer information. |
| Accessibility | Labeled controls, keyboard navigation, visible focus, readable contrast, and non-color transaction cues. |
| Performance | Target ordinary customer searches and summary reads within two seconds under an agreed pilot dataset and test network. |
| Scalability | Proposed pilot test dataset: 500 customers and 20,000 entries per store, with paginated histories. |
| Recovery | Document backup frequency, retention, and restoration; verify recovery before real records are used. |
| Connectivity | Proposed v1 saves require a connection; visibly distinguish unsaved work from confirmed transactions. |
| Maintainability | Shared money/date utilities and automated tests for critical ledger rules. |

---

## 11. Out of Scope

- Inventory quantities, purchase orders, and supplier management.
- Complete point-of-sale functionality or cash-sales accounting.
- Profit, expense, tax, and payroll calculations.
- Interest, penalties, credit scoring, or lending decisions.
- Online payment processing and bank or e-wallet integration.
- Automatic SMS or email payment reminders.
- Customer accounts or a public customer directory.
- Multiple branches and staff permission levels.
- AI chatbots, recommendations, and analytics.
- Offline transaction synchronization in the proposed initial production release.

Recording an item description does not reserve or deduct inventory. Recording a payment means the owner has received it; the application does not move money.

---

## 12. Assumptions & Decisions Log

| ID | Decision / assumption | Status |
|---|---|---|
| D01 | Product name is Tindahan; purpose is small-store utang tracking. | Required |
| D02 | Home, Daily Record, Search, Customers, customer history, and transaction forms are included. | Required |
| D03 | Bottom navigation uses Home, Daily Record, Search, Customers. | Required |
| D04 | Payments use green; unpaid utang uses orange or red. | Required |
| D05 | Contact number and transaction description are optional. | Required |
| D06 | Transaction dates default to today; previous days are viewable. | Required |
| D07 | One store and one owner account; no staff or customer logins. | Proposed |
| D08 | Currency is PHP and default timezone is Asia/Manila. | Proposed |
| D09 | Payments above the balance and future-dated entries are rejected. | Proposed |
| D10 | Balances are derived from ledger entries stored in centavos. | Proposed |
| D11 | Production delivery is a mobile-first web application. | Proposed |
| D12 | Production writes require internet; the current preview is session-only. | Proposed / current preview behavior |
| D13 | Corrections preserve the original entry and record a reason. | Proposed production extension |
| D14 | Existing notebook balances may be migrated as explicit opening entries. | Proposed |
| D15 | English labels with the familiar term “utang” are the initial language choice. | Proposed |
| D16 | You are the sole developer and handle the full development lifecycle. | Confirmed |

---

## 13. Personal Development Workflow

### Proposed Milestones

| Milestone | Deliverable | Acceptance condition |
|---|---|---|
| 1. Requirements and prototype | Confirmed scope and connected mobile frames | Both required flows can be demonstrated. |
| 2. Customer records | Search, customer creation, and profile/history views | Similar names stay distinct and records are store-scoped. |
| 3. Ledger | Persistent utang and payment operations | Partial/full payments, retry behavior, and balance rules pass. |
| 4. Summaries | Dashboard and date-based daily record | All totals reconcile with the underlying entries. |
| 5. Readiness | Recovery checks, usability review, and documentation | Pilot owner can complete core tasks and data can be restored. |

Work through the milestones one at a time. Use a simple checklist or optional GitHub Issues to record the next task, its expected result, and any bugs you discover.

For each feature, implement the smallest complete flow, test it, and commit the working change before moving on. Check changes to financial rules against the balance tests. Keep generated files separate from hand-maintained source, and document any change that alters the meaning of stored records.

Branches and pull requests are optional tools for organizing your own changes. No separate reviewer, team approval, or contributor process is required. Before a release, run the relevant checks and review your changes yourself against the acceptance scenarios below.

### Key Acceptance Scenarios

| Scenario | Expected result |
|---|---|
| Maria owes ₱850; owner records ₱150 utang | Customer balance becomes ₱1,000; outstanding total increases by ₱150. |
| Maria owes ₱850; owner records ₱200 payment | Customer balance becomes ₱650; outstanding total decreases by ₱200. |
| Customer owes ₱200; owner records ₱200 payment | Balance becomes zero and the history remains available. |
| Customer owes ₱200; owner attempts ₱250 payment | Save is rejected without modifying the ledger. |
| Two requests retry the same save ID | Exactly one entry exists. |
| Two concurrent payments exceed the available balance together | The backend prevents an overpaid ledger. |
| A previous date is selected | Only that day’s transactions and its historical closing balance appear. |
| A search finds no customer | A clear no-results state appears. |
| The owner corrects an entry | The original is retained as voided and totals recalculate consistently. |
| Another owner requests a customer ID | Backend access is denied. |

The ₱150 utang and ₱200 payment examples above are independent scenarios, each starting from ₱850.

---

## 14. Deployment

The standalone preview can be opened locally. It does not require deployment and does not provide production storage.

For the proposed production release:

1. Prepare separate staging and production environments.
2. Apply database constraints, access policies, and transactional write functions.
3. Configure owner sign-in and public frontend connection settings.
4. Deploy the frontend through HTTPS with application-route fallback handling.
5. Test using an ordinary owner account, including attempts to access another store.
6. Verify backups, restoration, and duplicate-save handling.
7. Reconcile any migrated opening balances before the owner begins live use.
8. Monitor failed saves and unexpected balance mismatches without logging unnecessary customer details.

You handle deployment and release checks. Hosting provider, operating cost, and backup schedule remain to be confirmed.

---

## 15. Ownership & License

Tindahan is developed by you as an individual project. Add your preferred author name to the repository documentation. Choose and document a distribution license before sharing the source code for reuse.

The example document’s copyright holder and licensing terms are not adopted by this project specification.

---

## 16. Glossary

| Term | Meaning |
|---|---|
| Utang | A customer purchase or debt that remains unpaid. |
| Payment | Money received by the owner and recorded against a customer’s debt. |
| Outstanding balance | The amount a customer still owes. |
| Partial payment | A payment smaller than the current balance. |
| Full payment | A payment that reduces the balance to zero. |
| Ledger | The ordered record of a customer’s opening balance, utang, and payments. |
| Running balance | The balance immediately after a particular ledger entry. |
| Daily record | Transactions effective on a selected store-local date. |
| Opening balance | Existing debt transferred from the paper notebook into the system. |
| Voided entry | A retained but inactive entry excluded from financial totals. |
| Idempotent save | A save that creates only one transaction even when the same request is retried. |

---

## 17. Open Questions & Risks

| Item | Question / risk | Next decision or mitigation |
|---|---|---|
| Platform | Is a mobile browser app sufficient, or is an installable native app required? | Confirm before production setup. |
| Connectivity | Does the store need to record transactions without internet? | If essential, include offline storage, synchronization, and conflict handling in scope. |
| Access | Will anyone besides the owner use the application? | Confirm before designing authentication and permissions. |
| Language | Should labels also be available in Filipino, Cebuano, or another language? | Review with the actual store owner. |
| Migration | Will old notebook history be entered, or only opening balances? | Choose a migration method and reconcile totals. |
| Corrections | Who may correct records, and are corrections required in the first release? | Confirm the proposed owner-only audited process. |
| Dates | Should an old entry’s effective time be editable? | Establish a consistent unknown-time rule and history ordering. |
| Recovery | How much recent data could the store tolerate losing? | Agree backup frequency and test restoration. |
| Customer identity | Similar names can lead to recording debt for the wrong person. | Display distinguishing details before saving. |
| Prototype scope | The connected Figma prototype uses prepared values and resets scenarios through general navigation. | Use it to review layout and navigation; implement persistent data entry in the production application. |
| Personal project setup | Repository, budget, and distribution license are unspecified. | Choose these as part of your setup and release preparation. |

The initial release is ready for a pilot when the owner can find a customer, record utang, record a payment, and review a day’s transactions with consistent, recoverable balances.
