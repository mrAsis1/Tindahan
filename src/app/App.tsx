import { useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { DataContext, refreshData, localRepository, useStoreQuery } from './data';
import { backendMode } from '../lib/api/supabase';
import { StoreSetup } from '../features/auth/AuthGate';
import { Dialog, ErrorMessage, Page } from '../components/ui';
import { Home } from '../features/dashboard/Home';
import { Customers, CustomerDetail } from '../features/customers/Customers';
import { NewCustomerPage } from '../features/customers/CustomerForm';
import { TransactionForm } from '../features/transactions/TransactionForm';
import { Confirmation } from '../features/transactions/Confirmation';
import { DailyRecord } from '../features/daily-record/DailyRecord';

export function App({
  ownerId = 'local',
  onSignOut,
}: {
  ownerId?: string;
  onSignOut?: () => Promise<void>;
}) {
  const query = useStoreQuery(ownerId);
  const cloud = backendMode === 'supabase';
  const [signOutError, setSignOutError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const [reset, setReset] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetting, setResetting] = useState(false);
  const hideNav = /\/(utang|payments)\/new|\/customers\/new|\/confirmation$/.test(
    location.pathname,
  );
  async function resetData(empty: boolean) {
    setResetting(true);
    try {
      await localRepository.reset(empty);
      await refreshData();
      setReset(false);
      navigate('/home');
    } catch (error) {
      setResetError(error instanceof Error ? error.message : 'Couldn’t reset. Try again.');
    } finally {
      setResetting(false);
    }
  }
  return (
    <div className="app-layout">
      <aside className="intro">
        <p className="brand">TINDAHAN</p>
        <h2>
          Your store.
          <br />
          Your notebook.
        </h2>
        <p>A simpler way to remember every utang and every payment.</p>
        <div className="intro-note">
          <strong>Made for the everyday tindahan.</strong>
          <p>Find a customer, record what they owe, and keep every payment in one place.</p>
        </div>
        <p className="small">
          {cloud ? 'Your private store notebook.' : 'Local demo · fictional records.'}
          <br />
          {cloud
            ? 'Sign in to access your records across devices.'
            : 'Your changes stay in this browser.'}
        </p>
      </aside>
      <div className={`app-shell ${hideNav ? 'without-nav' : ''}`}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div className="demo-bar">
          <span>
            {cloud ? (query.data?.store?.name ?? 'Cloud notebook') : 'Local demo · fictional data'}
          </span>
          {cloud ? (
            <button
              onClick={async () => {
                try {
                  await onSignOut?.();
                } catch (error) {
                  setSignOutError(
                    error instanceof Error ? error.message : 'Couldn’t sign out. Try again.',
                  );
                }
              }}
            >
              Sign out
            </button>
          ) : (
            <button
              onClick={() => {
                setResetError('');
                setReset(true);
              }}
            >
              Reset demo
            </button>
          )}
        </div>
        <ErrorMessage message={signOutError} />
        {query.isPending ? (
          <main id="main" className="empty" role="status">
            Opening your notebook…
          </main>
        ) : query.isError ? (
          <Page title="Notebook unavailable">
            <ErrorMessage message={query.error.message} />
            <button className="button" onClick={() => void query.refetch()}>
              Try again
            </button>
          </Page>
        ) : cloud && !query.data.store ? (
          <StoreSetup />
        ) : (
          <DataContext.Provider value={query.data}>
            <Routes>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<Home />} />
              <Route path="/daily-record" element={<DailyRecord />} />
              <Route path="/search" element={<Customers key="search" search />} />
              <Route path="/customers" element={<Customers key="customers" />} />
              <Route path="/customers/new" element={<NewCustomerPage />} />
              <Route path="/customers/:id" element={<CustomerDetail key={location.pathname} />} />
              <Route
                path="/utang/new"
                element={<TransactionForm key={`utang-${location.search}`} />}
              />
              <Route
                path="/payments/new"
                element={<TransactionForm key={`payment-${location.search}`} payment />}
              />
              <Route path="/transactions/:id/confirmation" element={<Confirmation />} />
              <Route
                path="*"
                element={
                  <Page title="Page not found" back="/home">
                    <p>Return to your notebook to keep going.</p>
                  </Page>
                }
              />
            </Routes>
          </DataContext.Provider>
        )}
        {!hideNav && (!cloud || !!query.data?.store) && (
          <nav className="bottom-nav" aria-label="Main navigation">
            {[
              ['/home', '⌂', 'Home'],
              ['/daily-record', '▤', 'Daily Record'],
              ['/search', '⌕', 'Search'],
              ['/customers', '♙', 'Customers'],
            ].map(([to, icon, label]) => (
              <NavLink key={to} to={to}>
                <span className="nav-icon" aria-hidden="true">
                  {icon}
                </span>
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        )}
        {!cloud && reset && (
          <Dialog
            title="Reset demo notebook?"
            onClose={() => {
              if (!resetting) setReset(false);
            }}
          >
            <div className="stack">
              <p>
                This replaces this browser’s demo customers and transactions. Your current demo
                entries will be removed.
              </p>
              <ErrorMessage message={resetError} />
              <button className="button" disabled={resetting} onClick={() => void resetData(false)}>
                Restore fictional records
              </button>
              <button
                className="button plain"
                disabled={resetting}
                onClick={() => void resetData(true)}
              >
                Start an empty notebook
              </button>
              <button className="button plain" disabled={resetting} onClick={() => setReset(false)}>
                Cancel
              </button>
            </div>
          </Dialog>
        )}
      </div>
    </div>
  );
}
