import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { initI18n } from './i18n';
import './styles/theme.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  void initI18n().finally(() => {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });
}

