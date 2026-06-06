import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AdminApp from './AdminApp';
import './index.css';

// Secret backoffice route. No router dependency — just switch on the path.
const isAdmin = window.location.pathname.startsWith('/chuchubeleza');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isAdmin ? <AdminApp /> : <App />}</React.StrictMode>,
);
