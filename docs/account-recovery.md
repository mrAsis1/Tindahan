# Owner password recovery

Password recovery is available in Supabase mode. The fictional local demo has no account or password; its browser storage remains separate from the cloud notebook.

## Use the flow

1. Start Tindahan with `npm run dev`. If port 5173 is occupied, use `npm run dev -- --port 5174 --strictPort` and open `http://127.0.0.1:5174`.
2. On the owner sign-in screen, select **Forgot password?**, enter your owner email, and select **Send reset link**. The confirmation deliberately does not reveal whether an account exists.
3. Open the newest email link on the same computer while the app is running. A localhost link on a phone points to the phone, not your development computer. Keep the link and password private.
4. Enter and confirm a new password of at least eight characters. Supabase may enforce additional requirements. Select **Update password**.
5. Sign in again with the new password and check that your existing notebook is still present. Recovery changes the account password, not customer or ledger records.

Expired, missing, and rejected links offer **Request a new link**. Rate limits and failed requests keep the email field available for retry. If the password saves but sign-out fails, **Finish signing out** retries sign-out without submitting another password change.

## Development configuration

The development project's Site URL remains `http://127.0.0.1:5173`. Its existing `http://localhost:5173` redirect is preserved. These exact recovery redirects are configured in both hosted Auth and `supabase/config.toml`:

- `http://127.0.0.1:5173/auth/reset-password`
- `http://localhost:5173/auth/reset-password`
- `http://127.0.0.1:5174/auth/reset-password`
- `http://localhost:5174/auth/reset-password`

The app requests a redirect to its current origin plus `/auth/reset-password`. Before using a different port or deployment hostname, add its exact callback URL in Supabase Authentication → URL Configuration. Production hosting also needs a single-page app fallback for both `/auth/forgot-password` and `/auth/reset-password`.

No SQL migration is needed. Public signup remains disabled. CLI configuration is not automatically applied: inspect the interactive `npx supabase config push --project-ref YOUR_PROJECT_REF` diff before accepting it. This task aligned existing email/MFA defaults locally so the hosted change only added recovery URLs.

## Implementation and verification

`src/features/auth/Recovery.tsx` uses the Supabase SDK's reset-email and password-update methods. `AuthGate.tsx` waits for Auth initialization, handles the recovery event, and keeps recovery navigation separate from notebook loading. The current browser client uses the SDK's implicit callback flow and persisted session. Only URL routing/error flags are captured by app code; the SDK handles tokens. Callback parameters are removed from the address bar after initialization. An authenticated session is required to change a password.

After a successful update, global sign-out revokes refresh sessions and clears the current session. Already-issued access tokens can remain valid until expiry; this is not an instant revocation guarantee for every device.

Run `npm run build`, `npm test`, and `npm run test:e2e`. Browser checks use local mode on 4178 and a fictional Supabase host with intercepted Auth responses on 4179. They exercise the installed SDK, callback handling, reload, rejected links, validation, sign-out retry, and signing in with the new password. They send no live email and change no hosted password.

Real email delivery and an owner-completed password reset still need a live check. Development email delivery depends on the hosted email provider's recipient restrictions and limits. Configure and verify custom SMTP, deployed HTTPS URLs, email templates, and delivery before a production pilot. Do not repeatedly request links while troubleshooting a rate limit.

References: [reset email API](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [password updates](https://supabase.com/docs/reference/javascript/auth-updateuser), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [password authentication](https://supabase.com/docs/guides/auth/passwords).
