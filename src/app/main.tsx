import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import { queryClient } from './data';
import { App } from './App';
import { AuthGate } from '../features/auth/AuthGate';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthGate>
          {(ownerId, onSignOut) => <App key={ownerId} ownerId={ownerId} onSignOut={onSignOut} />}
        </AuthGate>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
