import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import { initializeApiClient } from './api/client';
import { I18nProvider } from './i18n/I18nContext';
import './i18n';

const renderApplication = (): void => {
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <I18nProvider>
        <App />
      </I18nProvider>
    </React.StrictMode>,
  );
};

void initializeApiClient().finally(renderApplication);
