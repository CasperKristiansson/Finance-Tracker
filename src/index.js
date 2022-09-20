import React from 'react';
import ReactDOM from 'react-dom/client';
// import 'semantic-ui-css/semantic.min.css'
import './index.css';
import App from './App';
import './firebase.js';
import './sidebar/sidebar.css';
import {Chart, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement} from 'chart.js'

Chart.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <App />
);
<link
  async
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/semantic-ui@2/dist/semantic.min.css"
/>