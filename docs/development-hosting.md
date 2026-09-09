# Development hosting

Development address: https://tindahan-development.monarchrenante27.chatgpt.site

This private Sites deployment uses the existing **Tindahan Development** Supabase project and fictional notebook. It is for development testing, not a real-data pilot. Sites uses a live hosting slot for this address; it is not a temporary localhost tunnel.

## Open on your phone

1. Open the development address in your phone's browser. If Sites asks, sign in with the same ChatGPT account that owns this Site.
2. Sign in to Tindahan with your existing store owner email/password. This is separate from the ChatGPT access check.
3. Verify the existing notebook and fictional customers load. Record a small fictional utang/payment, refresh, then check the same history on your computer.
4. Request password recovery from the hosted app if needed. Open the newest email on your phone; its redirect should use the hosted `/auth/reset-password` address. Never share passwords or reset links.

Private Sites access is an extra gate before Tindahan's Supabase login. A reset link may arrive with credentials in its URL fragment; finish the Sites access sign-in first, then reopen the same newest email link if the gate interrupts the callback. Use ordinary browser tabs if an email app's embedded browser cannot retain the access session.

The hosted Site is owner-only. Sharing it with another tester requires an explicit access change. The app still keeps Supabase signup disabled and enforces owner-scoped data access.

## Deployment source and settings

`.openai/hosting.json` identifies this Site and selects Vite's `dist` output with single-page app fallback. Direct navigation and reload must work at `/home`, `/customers`, `/auth/forgot-password`, and `/auth/reset-password`.

The deployment is built with `VITE_DATA_BACKEND=supabase`, the development project URL, and its public publishable key from ignored `.env.local`. Vite embeds these public values at build time. Never put a secret/service-role key in a Vite variable. Sites runtime variables do not reconfigure an already-built static bundle; rebuild after changing public connection settings.

Supabase's Site URL uses the hosted development origin. Its redirect allowlist retains the local development callbacks on ports 5173/5174 and adds the exact hosted reset path. Inspect `npx supabase config push --project-ref bzkbndvmspnyjkuyaudr` before accepting changes. No database migration is part of hosting.

Continue changes on `codex/...` task branches from `develop`. GitHub pull requests and checks remain the development source workflow. Sites also requires the validated source commit in its own repository before saving and privately deploying the packaged build. Use only the Site-provided short-lived credentials with per-command authentication; never save them in Git config, URLs, files, or logs.

Build with `npm run build`. Use the Sites hosting skill's packaging helper to package only `dist` plus hosting metadata; exclude source, `.env.local`, session data, and local check outputs. Keep the build and archive from the same committed source. Existing `main` remains the release baseline; publishing this development Site does not promote a release.

## Phone checklist and remaining work

- Sign in/out and reload a nested customer/history page.
- Create a fictional customer, add utang, and record partial/full payments.
- Complete password recovery from the hosted address after signing into private Site access.
- Check keyboard overlap, scrolling, tap targets, and any email-app browser differences.
- Check uncertain saves carefully: retry state lasts while the form stays open; inspect history after a reload before creating another entry.

On 9 September 2026, the owner confirmed the hosted notebook loads on their phone. Transaction entry, hosted password recovery, and the rest of the phone checklist still need separate verification. Production hosting/access, custom SMTP, backup restoration, pagination/performance, and a real-data pilot remain separate milestones.
