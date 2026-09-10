import { Component, Suspense, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Page } from './ui';

// Keep failed page downloads recoverable without automatically reloading a form.
export class PageLoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <Page title="Page unavailable">
          <p role="alert">Couldn’t open this page. Check your connection, then reload.</p>
          <button className="button" onClick={() => window.location.reload()}>
            Reload page
          </button>
          <Link className="button plain" to="/home">
            Return to Home
          </Link>
        </Page>
      );
    return (
      <Suspense
        fallback={
          <main id="main" className="empty" role="status">
            Opening this page…
          </main>
        }
      >
        {this.props.children}
      </Suspense>
    );
  }
}
