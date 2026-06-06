import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AdminApp from './AdminApp';
import Landing from './Landing';
import './index.css';

// Lightweight path routing — no router dependency. nginx serves index.html for
// every path, so this just picks the view:
//   /chuchubeleza  → admin backoffice
//   /app           → the card editor
//   /              → marketing landing (SEO content)
const path = window.location.pathname;
// /billing/* is where Stripe Checkout returns (success/cancel) — the editor
// handles the post-checkout confirmation, so route it to <App/>.
const isApp = path.startsWith('/app') || path.startsWith('/billing');
const view = path.startsWith('/chuchubeleza') ? (
  <AdminApp />
) : isApp ? (
  <App />
) : (
  <Landing />
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{view}</React.StrictMode>,
);
