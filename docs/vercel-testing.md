# Vercel testing handoff

This is a **fictional-data testing release**, not approval for real store balances. The owner will connect Vercel. No Vercel project, deployment, subscription or domain is created by this repository change. Use free services only; do not accept a paid trial or upgrade. Vercel Hobby is for personal/non-commercial use, so this handoff is for personal project testing, not a commercial store rollout. See [Vercel plans](https://vercel.com/pricing).

## Connect the repository

After the checked testing release reaches `main`, import `mrAsis1/Tindahan` into Vercel. Use the repository root, **Vite**, `npm run build`, and output directory `dist`. Select Node **24.x**, consistent with the project's Node 24 requirement. Let the committed lockfile and package-manager setting control dependency installation. The repository's `vercel.json` supplies the build/output settings and the [recommended Vite SPA rewrite](https://vercel.com/docs/frameworks/frontend/vite), so customer and recovery URLs can load directly.

Use `main` for the stable testing deployment. Continued work stays on task branches from `develop`; checked release PRs promote later versions. Vercel's label “Production” for its main-branch deployment does not mean Tindahan has passed production readiness. Review automatic deployments before connecting: later pushes/merges may trigger builds. Do not connect the older `main` baseline before the testing release is merged.

## Enter these build environment variables before deploying

| Variable                        | Value                                                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_DATA_BACKEND`             | `supabase`                                                                                                                        |
| `VITE_SUPABASE_URL`             | `https://bzkbndvmspnyjkuyaudr.supabase.co`                                                                                        |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Copy the existing development project's **publishable** key from Supabase's project settings; never use a secret/service-role key |

These are development settings for fictional records. Set them for the intended main-branch deployment environment. If enabling previews, explicitly configure previews with development values too. Do not use a production database. Vite embeds these values during the build, so redeploy after changing them. `.env.local` is ignored by Git and is not automatically sent to Vercel. Missing backend selection defaults to the local demo; a page showing demo data is not a successful Supabase deployment.

The development migration `20260910090000_scoped_notebook_reads.sql` was applied and verified on 11 September 2026. All three repository migrations are installed there. Do not rerun them, reset the database or import demo data. Existing fictional records are shared with the current development Site and must be preserved.

## Configure recovery after Vercel gives you the address

Use one stable HTTPS address. In the **development** Supabase project's Authentication URL Configuration, add its exact `https://YOUR-VERCEL-HOST/auth/reset-password` to the redirect allowlist. Do not paste the placeholder literally. Preserve the existing Sites and localhost URLs and leave public signup disabled. The app requests its current origin's reset path; changing the existing Site URL is not necessary for this additional testing address. See [account recovery](account-recovery.md) and [Supabase redirect rules](https://supabase.com/docs/guides/auth/redirect-urls).

If Vercel access protection interrupts a reset link, finish that access sign-in and reopen the newest email link. Do not share passwords or link tokens. A successful deployment does not itself configure Supabase redirects or email delivery. The existing development email restrictions still apply; custom production email remains pending.

## Verify the deployed result

1. Confirm the deployed commit matches the testing release. Open the site and sign in with your existing development owner account. Confirm existing customers/history rather than resetting or creating a new notebook.
2. Reload `/home`, `/customers`, an existing customer history URL, `/auth/forgot-password` and `/auth/reset-password`. A reset URL without a valid link should show the recovery guidance, not a Vercel 404. Verify JavaScript/CSS assets load normally.
3. Create a uniquely named **Fictional Vercel check** customer with an identifying test note. If it already exists, inspect history before continuing. Enter ₱150 utang, ₱50 payment and ₱100 payment; reload history and confirm exactly three entries and zero balance. Preserve the fixture.
4. Test field scrolling and save buttons with the physical-phone keyboard open. Record phone/browser/network and any delays. If a save is uncertain, use its original retry or inspect history before making a new entry.
5. After the exact callback is configured, request one recovery email, use the newest link privately, update the password and sign in again. Confirm the same notebook remains.

Record the URL, deployed commit, date and results in the project records without credentials or reset tokens. Vercel routing and this new origin's recovery/phone behavior remain unverified until these hosted checks run. Local browser tests verify application behavior but do not emulate Vercel's platform.

## Release limits

The application and migration tests pass, but [Stage 5 readiness](production-readiness.md) remains open: hosted restoration, backup policy, physical-phone performance of this version, production/email setup and a small-store pilot are outstanding. There is no production database or operational backup schedule. Do not use real debt records for this testing release. The existing private Sites deployment and hosting metadata remain unchanged.
