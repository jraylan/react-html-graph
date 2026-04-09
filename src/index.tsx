import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './example/App';
import reportWebVitals from './example/reportWebVitals';
import './example/index.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();
