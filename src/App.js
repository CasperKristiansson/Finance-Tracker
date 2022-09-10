import './App.css';

import Sidebar from './sidebar/sidebar';
import Home from './home/home';
import YearlyReport from './yearlyReport/yearlyReport';
import TotalReport from './totalReport/totalReport';
import { Route, Routes, Navigate, BrowserRouter } from 'react-router-dom';

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Sidebar />
        <div>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/yearlyReport" element={<YearlyReport />} />
            <Route path="totalReport" element={<TotalReport />} />
          </Routes>
        </div>
      </BrowserRouter>
    </div>
  );
}

export default App;
