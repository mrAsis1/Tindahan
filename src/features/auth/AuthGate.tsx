import { useEffect, useState, type ReactNode, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { backendMode, configurationError, createStore, supabase } from '../../lib/api/supabase';
import { queryClient, refreshData } from '../../app/data';
import { ErrorMessage, Field, Page } from '../../components/ui';

function SignIn({ onRetry }: { onRetry: () => void }) {
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
      onRetry();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Couldn’t sign in. Try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page title="Your store notebook" brand="TINDAHAN">
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
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let authEventReceived = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      authEventReceived = true;
      if (active) {
        setSession(next);
        setLoading(false);
      }
    });
    void supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active || authEventReceived) return;
        setError(sessionError?.message ?? '');
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setError('Couldn’t check your session. Try again.');
          setLoading(false);
        }
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [retry]);
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
  if (session)
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
            <ErrorMessage message={error} />
            <SignIn onRetry={() => setRetry((v) => v + 1)} />
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
