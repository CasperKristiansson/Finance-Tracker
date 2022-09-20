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
import FloatingButton from './floatingButton/floatingButton';
import Download from './download/download';
import Login from './login/login';

import { Route, Routes, BrowserRouter, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

import { } from './firebase.js';

import {
  getAuth,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  updateProfile
} from "firebase/auth";


function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [auth, setAuth] = useState(null);

  useEffect(() => {
    console.log('Checking login');
    var authVar = getAuth()
    setAuth(authVar);

    setPersistence(authVar, browserLocalPersistence).then(() => {
      onAuthStateChanged(authVar, (user) => {
          if (user) {
            setUser(user);
            setLoggedIn(true);
            setLoading(false);
          } else {
            setLoggedIn(false);
            setLoading(false);

            if (window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
          }
      });
    });
  }, []);

  return (
    <div className="App">
      <BrowserRouter>
        {loggedIn && !loading ? (
          <>
          <Sidebar />
          <FloatingButton />
          </>
        ) : (
          <></>
        )}
        <div>
          <Routes>
            {loggedIn && !loading ? (
              <>
              <Route path="/" element={<Home user={user} />} />
              <Route path="/yearlyReport" element={<YearlyReport user={user} />} />
              <Route path="/totalReport" element={<TotalReport user={user} />} />
              <Route path="/accounts" element={<Accounts user={user} />} />
              <Route path="/accountsReport" element={<AccountsReport user={user} />} />
              <Route path="/addTransaction" element={<AddTransaction user={user} />} />
              <Route path="/editTransaction/*" element={<EditTransaction user={user} />} />
              <Route path="/editAccount/*" element={<EditAccount user={user} />} />
              <Route path="/milestones" element={<Milestones user={user} />} />
              <Route path="/download" element={<Download user={user} />} />
              </>
            ) : (
              <Route path="/login" element={<Login auth={auth} setUser={(user) => setUser(user)} />} />
            )}
          </Routes>
        </div>
      </BrowserRouter>
    </div>
  );
}

export default App;
