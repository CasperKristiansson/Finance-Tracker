import React from 'react';
import ReactDOM from 'react-dom/client';
// import 'semantic-ui-css/semantic.min.css'
import './index.css';
import App from './App';
import './sidebar/sidebar.css';
import {Chart, ArcElement, Tooltip, Legend} from 'chart.js'

Chart.register(ArcElement, Tooltip, Legend);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
<link
    async
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/semantic-ui@2/dist/semantic.min.css"
  />