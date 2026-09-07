import { useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  backendMode,
  configurationError,
  createStore,
  initialRecovery,
  supabase,
} from '../../lib/api/supabase';
import { queryClient, refreshData } from '../../app/data';
import { ErrorMessage, Field, Page } from '../../components/ui';
import { RequestRecovery, ResetPassword } from './Recovery';
import { FORGOT_PATH, RESET_PATH } from './recoveryHelpers';

function SignIn({
  onSignedIn,
  passwordUpdated,
}: {
  onSignedIn: () => void;
  passwordUpdated: boolean;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      setPassword('');
      onSignedIn();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Couldn’t sign in. Try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page title="Your store notebook" brand="TINDAHAN">
      {passwordUpdated && (
        <p className="card note" role="status">
          Password updated. Sign in with your new password.
        </p>
      )}
      <p className="small muted">Sign in to your store account.</p>
      <form className="stack" onSubmit={submit}>
        <Field label="Email" id="email">
          <input
            id="email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password" id="password">
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <ErrorMessage message={error} />
        <button className="button" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="small muted">Use the owner account set up for this store.</p>
      </form>
      <Link className="button plain" to={FORGOT_PATH}>
        Forgot password?
      </Link>
    </Page>
  );
}

export function AuthGate({
  children,
}: {
  children: (ownerId: string, signOut?: () => Promise<void>) => ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(backendMode === 'supabase');
  const [error, setError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const initialNavigate = useRef(navigate);
  const [recovering, setRecovering] = useState(initialRecovery.requested);
  const [linkError, setLinkError] = useState(initialRecovery.hasError);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let authEventReceived = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      authEventReceived = true;
      if (active) {
        setSession(next);
        if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      }
    });
    void supabase.auth
      .initialize()
      .then(async ({ error: callbackError }) => {
        if (!active) return;
        if (callbackError) {
          setLinkError(true);
          setError('Couldn’t verify your sign-in link. Request a new link or sign in again.');
        }
        const { data, error: sessionError } = await supabase!.auth.getSession();
        if (!active) return;
        if (sessionError) setError(sessionError.message);
        else if (!callbackError) setError('');
        if (!authEventReceived) setSession(data.session);
        setLoading(false);
        if (initialRecovery.requested) initialNavigate.current(RESET_PATH, { replace: true });
      })
      .catch(() => {
        if (active) {
          setError('Couldn’t check your session. Try again.');
          setLinkError(true);
          setLoading(false);
        }
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  // Do not retain another owner's notebook in the query cache on account changes.
  useEffect(() => {
    if (backendMode === 'local') return;
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] === 'store' && query.queryKey[1] !== session?.user.id,
    });
  }, [session?.user.id]);
  if (configurationError)
    return (
      <div className="app-layout">
        <div className="app-shell without-nav">
          <Page title="Connection setup">
            <ErrorMessage message={configurationError} />
          </Page>
        </div>
      </div>
    );
  if (backendMode === 'local') return children('local');
  const recoveryPage =
    recovering || location.pathname === RESET_PATH || location.pathname === FORGOT_PATH;
  async function exitRecovery(updated = false) {
    if (session) {
      const { error: signOutError } = await supabase!.auth.signOut({ scope: 'local' });
      if (signOutError) throw signOutError;
    }
    queryClient.removeQueries({ queryKey: ['store'] });
    setRecovering(false);
    setLinkError(false);
    setError('');
    navigate('/home', { replace: true, state: { passwordUpdated: updated } });
  }
  if (session && !recoveryPage && !loading)
    return children(session.user.id, async () => {
      const { error } = await supabase!.auth.signOut({ scope: 'local' });
      if (error) throw error;
      queryClient.removeQueries({ queryKey: ['store'] });
    });
  return (
    <div className="app-layout">
      <div className="app-shell without-nav">
        <div className="demo-bar">Cloud notebook · private owner account</div>
        {loading ? (
          <p className="empty" role="status">
            Checking your session…
          </p>
        ) : (
          <>
            {location.pathname === FORGOT_PATH ? (
              <RequestRecovery onExit={() => exitRecovery()} />
            ) : recoveryPage ? (
              <ResetPassword
                session={session}
                linkError={linkError}
                onExit={() => exitRecovery()}
                onComplete={() => {
                  queryClient.removeQueries({ queryKey: ['store'] });
                  setRecovering(false);
                  setLinkError(false);
                  setError('');
                  navigate('/home', { replace: true, state: { passwordUpdated: true } });
                }}
              />
            ) : (
              <>
                <ErrorMessage message={error} />
                <SignIn
                  onSignedIn={() => setError('')}
                  passwordUpdated={location.state?.passwordUpdated === true}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function StoreSetup() {
  const [name, setName] = useState('Tindahan');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Page title="Name your store">
      <p className="small muted">Create your private notebook. Your balance starts at ₱0.00.</p>
      <form
        className="stack"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          try {
            await createStore(name);
            await refreshData();
          } catch (cause) {
            setError(
              cause instanceof Error ? cause.message : 'Couldn’t create the notebook. Try again.',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Store name" id="store-name">
          <input
            id="store-name"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <ErrorMessage message={error} />
        <button className="button" disabled={busy}>
          {busy ? 'Creating…' : 'Create notebook'}
        </button>
      </form>
    </Page>
  );
}
