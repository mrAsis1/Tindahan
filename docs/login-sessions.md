# Remembered sign-in

Tindahan saves the Supabase session in this browser's local storage and automatically
refreshes expired access tokens. It does not save the owner's password. Reopening
the same site in the same browser restores the login. Sign out removes the saved
session for this device; another device must sign in separately.

The login form includes Show password / Hide password. Passwords start hidden.
If browser storage cannot save the session, sign-in reports an error instead of
silently using a temporary session.

## Hosted configuration

In the hosted Supabase project's Auth session settings, leave time-boxed sessions,
inactivity timeout, and single-session enforcement disabled to keep each device
signed in until logout. These settings cannot be changed by this frontend or by
editing the local Supabase configuration.

On 15 September 2026, a read-only Management API check of the existing **Asis_Store**
project (`vmvshmarpwuwgoxooiuo`) confirmed `sessions_timebox = 0`,
`sessions_inactivity_timeout = 0`, `sessions_single_per_user = false`, and refresh
token rotation enabled. Access tokens expire after 3600 seconds and are renewable.
No hosted configuration was changed. These values rule out configured session
timeouts as the cause; the owner's browser-specific repeated login remains
unreproduced. Use the same stable site address and browser on each visit.

Keep the normal short access-token lifetime: automatic refresh extends the session
without asking for the password. See [Supabase session documentation](https://supabase.com/docs/guides/auth/sessions).

Clearing browser data, private browsing, switching browser or site address, a
password reset, or a server-revoked session can require signing in again.

## Verification

`npm test -- tests/unit/auth-session.test.ts tests/unit/recovery.test.ts` checks the
real Supabase SDK with fictional HTTP responses: a fresh browser has no session,
sign-in persists tokens without the password, reopening with an access token that
expired two hours earlier refreshes it, and local sign-out removes the session.
It also checks the blocked-storage message. This is not a live-server validation.
