import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth.jsx';
import { EntitlementsProvider } from './entitlements.jsx';
import { applyTheme, loadTheme } from './theme.js';
import './styles.css';

applyTheme(loadTheme());

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <EntitlementsProvider>
          <App />
        </EntitlementsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
