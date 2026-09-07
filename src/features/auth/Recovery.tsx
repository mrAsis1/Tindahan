import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/api/supabase';
import { ErrorMessage, Field, Page } from '../../components/ui';
import {
  FORGOT_PATH,
  RESET_PATH,
  invalidRecoveryMessage,
  passwordProblem,
} from './recoveryHelpers';

type Exit = () => Promise<void>;

export function RequestRecovery({ onExit }: { onExit: Exit }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      const { error: requestError } = await supabase!.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}${RESET_PATH}`,
      });
      if (
        requestError &&
        !['user_not_found', 'email_not_found'].includes(requestError.code ?? '')
      ) {
        if (requestError.status === 429) {
          setError('Too many requests. Wait a few minutes before trying again.');
          return;
        }
        throw requestError;
      }
      setSent(true);
    } catch {
      setError(
        'Couldn’t request a reset email. Check your connection and try again. If this continues, check the store’s email setup.',
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <Page title="Forgot password?" brand="TINDAHAN">
      {sent ? (
        <div className="card note" role="status">
          <h2>Check your email</h2>
          <p>
            If an owner account exists for that address, a password reset link will arrive shortly.
            Check your spam folder too.
          </p>
          <p className="small muted">
            Open the newest link on a device that can reach this Tindahan app.
          </p>
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
          <p className="small muted">
            Enter your store owner email to request a password reset link.
          </p>
          <Field label="Owner email" id="recovery-email">
            <input
              id="recovery-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <ErrorMessage message={error} />
          <button className="button" disabled={busy}>
            {busy ? 'Requesting link…' : 'Send reset link'}
          </button>
        </form>
      )}
      {sent && (
        <button
          className="button plain"
          onClick={() => {
            setSent(false);
            setError('');
          }}
        >
          Use a different email
        </button>
      )}
      <button
        className="button plain"
        disabled={busy}
        onClick={() =>
          void onExit().catch(() => setError('Couldn’t return to sign-in. Try again.'))
        }
      >
        Back to sign in
      </button>
      {sent && <ErrorMessage message={error} />}
    </Page>
  );
}

export function ResetPassword({
  session,
  linkError,
  onExit,
  onComplete,
}: {
  session: Session | null;
  linkError: boolean;
  onExit: Exit;
  onComplete: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const otherSessionsEnded = useRef(false);
  async function finish() {
    // The password may already be changed when sign-out fails. Keep that result
    // separate, so a retry only finishes sign-out instead of changing it again.
    // The SDK clears this session even on a failed global/local logout. End
    // other sessions first so a failed remote request retains a session to retry.
    if (!otherSessionsEnded.current) {
      const { error: otherError } = await supabase!.auth.signOut({ scope: 'others' });
      if (otherError) {
        setError(
          'Your password was updated, but sign-out did not finish. Try finishing sign-out again.',
        );
        return;
      }
      otherSessionsEnded.current = true;
    }
    const { error: signOutError } = await supabase!.auth.signOut({ scope: 'local' });
    if (signOutError) {
      setError(
        'Your password was updated, but sign-out did not finish. Try finishing sign-out again.',
      );
      return;
    }
    onComplete();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving.current) return;
    const problem = passwordProblem(password, confirmation);
    if (problem) {
      setError(problem);
      return;
    }
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      const { error: updateError } = await supabase!.auth.updateUser({ password });
      if (updateError) {
        if (
          [401, 403].includes(updateError.status ?? 0) ||
          ['session_not_found', 'session_expired', 'reauthentication_needed'].includes(
            updateError.code ?? '',
          )
        ) {
          setInvalid(true);
          setPassword('');
          setConfirmation('');
          return;
        }
        setError(
          updateError.code === 'same_password'
            ? 'Choose a password different from your current password.'
            : updateError.code === 'weak_password'
              ? 'Choose a stronger password and try again.'
              : 'Couldn’t confirm the password update. Check your connection and try again. If it may have saved, try signing in with the new password.',
        );
        return;
      }
      setPassword('');
      setConfirmation('');
      setUpdated(true);
      await finish();
    } catch {
      setError('Couldn’t finish the request. Check your connection and try again.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  if (updated)
    return (
      <Page title="Password updated" brand="TINDAHAN">
        <p role="status">
          Your new password has been saved. Finish signing out, then sign in with it.
        </p>
        <ErrorMessage message={error} />
        <button
          className="button"
          disabled={busy}
          onClick={async () => {
            if (saving.current) return;
            saving.current = true;
            setBusy(true);
            setError('');
            try {
              await finish();
            } catch {
              setError('Your password is saved. Couldn’t finish signing out; try again.');
            } finally {
              saving.current = false;
              setBusy(false);
            }
          }}
        >
          {busy ? 'Finishing…' : 'Finish signing out'}
        </button>
      </Page>
    );
  if (linkError || invalid || !session)
    return (
      <Page title="Reset link unavailable" brand="TINDAHAN">
        <p role="alert">{invalidRecoveryMessage}</p>
        <Link className="button" to={FORGOT_PATH}>
          Request a new link
        </Link>
        <ErrorMessage message={error} />
        <button
          className="button plain"
          onClick={() =>
            void onExit().catch(() => setError('Couldn’t return to sign-in. Try again.'))
          }
        >
          Back to sign in
        </button>
      </Page>
    );
  return (
    <Page title="Choose a new password" brand="TINDAHAN">
      <p className="small muted">
        Use at least 8 characters. After saving, sign in again with your new password.
      </p>
      <form className="stack" onSubmit={submit}>
        <Field label="New password" id="new-password">
          <input
            id="new-password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Field label="Confirm new password" id="confirm-password">
          <input
            id="confirm-password"
            type="password"
            required
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </Field>
        <ErrorMessage message={error} />
        <button className="button" disabled={busy}>
          {busy ? 'Updating password…' : 'Update password'}
        </button>
      </form>
      <button
        className="button plain"
        disabled={busy}
        onClick={() =>
          void onExit().catch(() => setError('Couldn’t return to sign-in. Try again.'))
        }
      >
        Cancel and sign out
      </button>
    </Page>
  );
}
