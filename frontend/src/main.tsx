import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AdminApp from './AdminApp';
import Landing from './Landing';
import Legal from './Legal';
import { UseCasePage } from './seo/UseCasePage';
import { findUseCase } from './seo/useCases';
import './index.css';

// Lightweight path routing — no router dependency. nginx serves index.html for
// every path, so this just picks the view:
//   /chuchubeleza            → admin backoffice
//   /app                     → the card editor
//   /{platform}-review-to-*  → programmatic-SEO use-case pages
//   /                        → marketing landing (SEO content)
const path = window.location.pathname;
// /billing/* is where Stripe Checkout returns (success/cancel) — the editor
// handles the post-checkout confirmation, so route it to <App/>.
const isApp = path.startsWith('/app') || path.startsWith('/billing');
const useCase = findUseCase(path);
const view = path.startsWith('/chuchubeleza') ? (
  <AdminApp />
) : path.startsWith('/privacy') ? (
  <Legal kind="privacy" />
) : path.startsWith('/terms') ? (
  <Legal kind="terms" />
) : isApp ? (
  <App />
) : useCase ? (
  <UseCasePage def={useCase} />
) : (
  <Landing />
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{view}</React.StrictMode>,
);
