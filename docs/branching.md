# Development and release workflow

Use two long-lived branches, with short task branches. Review your own changes and test before merging; this workflow does not require another developer.

| Branch                    | Purpose                               | Start from       | Merge into                       |
| ------------------------- | ------------------------------------- | ---------------- | -------------------------------- |
| `main`                    | Stable release baseline               | Existing history | Receives tested releases         |
| `develop`                 | Integrates completed development work | `main` initially | `main` when releasing            |
| `codex/feature/<name>`    | New feature                           | `develop`        | `develop`                        |
| `codex/fix/<name>`        | Development bug fix                   | `develop`        | `develop`                        |
| `codex/chore/<name>`      | Maintenance, documentation, tooling   | `develop`        | `develop`                        |
| `codex/release/<version>` | Optional release stabilization        | `develop`        | `main`, then back into `develop` |
| `codex/hotfix/<name>`     | Urgent fix to a released version      | `main`           | `main`, then back into `develop` |

Create task, release, and hotfix branches when there is work for them. The setup task uses `codex/chore/development-workflow`. Existing commits on `main` are preserved as the starting baseline; branch names do not certify that the app is production-ready.

## Everyday work

Start with a clean working tree. Commit or deliberately stash unfinished work before switching branches.

```sh
git switch develop
git pull --ff-only
git switch -c codex/feature/your-feature-name
```

Build the smallest complete change, run the relevant checks, and update `docs/progress.md`. Stage the intended files and commit. Publish the task branch:

```sh
git push -u origin HEAD
```

Open a pull request with **base `develop`**. Review the diff and wait for **Checks / Build and test** to pass, then merge. A merge commit preserves the task history. Keep `main` for the release step. After merging, return to `develop` and pull with `--ff-only`; start the next task on a new branch.

## Checks

GitHub Actions checks pushes to `main`, `develop`, and `codex/**`, plus pull requests targeting `develop` or `main`. It runs formatting, TypeScript/build, unit/PostgreSQL tests, and mobile/desktop browser tests. It uses local fictional mode, read-only repository permissions, and no Supabase secrets. It neither deploys the application nor applies hosted migrations.

Local equivalents:

```sh
npm run format:check
npx prettier --check .github
npm run check
```

Branch protections are a separate GitHub setting; this workflow file alone does not prevent direct pushes. If enabling protection for `main` and `develop`, require a pull request and the successful **Build and test** check, disallow force pushes/deletion, and keep required approving reviews at zero for a solo developer. No protection rules were automatically changed by this setup.

## Releases and database environments

For a small release, review a pull request from `develop` to `main`, run the release checks, merge, and tag the released commit. Use `codex/release/<version>` only when a release needs stabilization while other development continues. Merge any stabilization or hotfix changes back into `develop` so the branches retain them.

Git branches organize code. They do **not** create separate Supabase databases or change `.env.local` when you switch branches. The current hosted project, `bzkbndvmspnyjkuyaudr`, is development-only. Production hosting and a separate production Supabase project remain future setup work. Do not use real customer balances for this development notebook.

Create a new SQL migration for each database change, test it, inspect the dry run, and explicitly apply it to the intended project using [the Supabase guide](supabase-setup.md). The initial migration has already been installed and registered; do not edit or rerun it. Release tags and deployment should track which migrations the released application requires.
