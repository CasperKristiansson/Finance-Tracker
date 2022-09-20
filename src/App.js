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
import Logout from './login/logout';

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

	var loadedUser = false;

  useEffect(() => {
    if (!loadedUser) {
      var authVar = getAuth()
      loadedUser = true;
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
    }
    
  }, []);

  const handleLogOut = () => {
    auth.signOut().then(() => {
      window.location.href = '/login';
    });
  }

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
              <Route path="/" element={<Home userID={user.uid} />} />
              <Route path="/yearlyReport" element={<YearlyReport userID={user.uid} />} />
              <Route path="/totalReport" element={<TotalReport userID={user.uid} />} />
              <Route path="/accounts" element={<Accounts userID={user.uid} />} />
              <Route path="/accountsReport" element={<AccountsReport userID={user.uid} />} />
              <Route path="/addTransaction" element={<AddTransaction userID={user.uid} />} />
              <Route path="/editTransaction/*" element={<EditTransaction userID={user.uid} />} />
              <Route path="/editAccount/*" element={<EditAccount userID={user.uid} />} />
              <Route path="/milestones" element={<Milestones userID={user.uid} />} />
              <Route path="/download" element={<Download userID={user.uid} />} />
              <Route path="/logout" element={<Logout signOut={handleLogOut} />} />
              </>
            ) : (
              <>
              <Route path="/" element={<></>} />
              <Route path="/login" element={<Login auth={auth} setUser={(user) => setUser(user)} />} />
              </>
            )}
          </Routes>
        </div>
      </BrowserRouter>
    </div>
  );
}

export default App;
