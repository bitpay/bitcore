import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import {Provider} from 'react-redux';
import {store} from './store';

// Handle redirection for hash-based URLs
const handleURLRedirection = () => {
  const initialURL = window.location.href;
  if (initialURL.includes('/#/')) {
    window.location.href = initialURL.replace('/#/', '/');
    return true;
  }
  return false;
};

const initializeApp = () => {
  const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
  root.render(
    <React.StrictMode>
      <Provider store={store}>
        <App />
      </Provider>
    </React.StrictMode>,
  );
};

if (!handleURLRedirection()) {
  // Initialize the app only if redirection is not needed
  initializeApp();
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
