import './App.css';

import Sidebar from './sidebar/sidebar';
import Home from './home/home';
import YearlyReport from './yearlyReport/yearlyReport';
import TotalReport from './totalReport/totalReport';
import Accounts from './accounts/accounts';
import AccountsReport from './accounts/accountsReport';
import AddTransaction from './transactions/addTransaction';
import EditTransaction from './transactions/editTransaction';
import EditAccount from './transactions/editAccount';
import Milestones from './milestones/milestones';
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
            <Route path="/totalReport" element={<TotalReport />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/accountsReport" element={<AccountsReport />} />
            <Route path="/addTransaction" element={<AddTransaction />} />
            <Route path="/editTransaction/*" element={<EditTransaction />} />
            <Route path="/editAccount/*" element={<EditAccount />} />
            <Route path="/milestones" element={<Milestones />} />
          </Routes>
        </div>
      </BrowserRouter>
    </div>
  );
}

export default App;
