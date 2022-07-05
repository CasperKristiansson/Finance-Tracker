import './App.css';

import Sidebar from './sidebar/sidebar';
import Home from './home/home';
import { Route, Routes, Navigate, BrowserRouter } from 'react-router-dom';

function App() {
  return (
    <div className="App">
      <Sidebar />
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
