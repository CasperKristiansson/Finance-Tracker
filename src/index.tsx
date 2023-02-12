import ReactDOM from 'react-dom/client';
import App from './App';
import { JssProvider } from 'react-jss';

import {Chart, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement} from 'chart.js'

Chart.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement);

<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/semantic-ui@2/dist/semantic.min.css"
/>

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <JssProvider id={{ minify: true }}>
    <App />
  </JssProvider>
);