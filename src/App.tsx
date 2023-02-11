import './App.css';

import { Sidebar } from './Pages/Sidebar/Sidebar';
import { Home } from './Pages/Home/Home';
import { YearlyReport } from './Pages/YearlyReport/YearlyReport';
import { TotalReport } from './Pages/TotalReport/TotalReport';
import { Accounts } from './Pages/Accounts/Accounts';
import { AccountsReport } from './Pages/AccountsReport/AccountsReport';
import { AddTransaction } from './Pages/ManageTransaction/AddTransaction';
import { EditTransaction } from './Pages/ManageTransaction/EditTransaction';
import { EditAccount } from './Pages/ManageTransaction/EditAccount';
import { Milestones } from './Pages/Milestones/Milestones';
import { FloatingButton } from'./Pages/FloatingButton/FloatingButton';
import { Download } from './Pages/Download/Download';
import { Login } from './Pages/Login/Login';
import { Logout } from './Pages/Logout/Logout';
import { TransactionView } from './Pages/TransactionView/TransactionView';

import { Route, Routes, BrowserRouter } from 'react-router-dom';
import { useEffect, useState } from 'react';

import './firebase.ts';

import { getAuth, onAuthStateChanged, setPersistence, browserLocalPersistence } from "firebase/auth";

import { createUseStyles } from "react-jss";
import React from 'react';

const useStyles = createUseStyles({
  mainSection: {
		marginLeft: 270,
    padding: "20px 25px 25px 25px",
	},
});

export const App: React.FC<{ }> = ({ }): JSX.Element => {
  const classes = useStyles();

  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null as any);
  const [auth, setAuth] = useState(null as any);

  useEffect(() => {
    const authVar: any = getAuth()
    setAuth(authVar);

    setPersistence(authVar, browserLocalPersistence).then(() => {
      onAuthStateChanged(authVar, (user) => {
          if (user) {
            setUser(user);
            setLoggedIn(true);
            setLoading(false);

            if (window.location.pathname === '/login') {
              window.location.href = '/';
            }
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
        <div className={classes.mainSection}>
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
              <Route path="/transactionsView" element={<TransactionView userID={user.uid} />} />
              <Route path="/logout" element={<Logout logout={handleLogOut} />} />

              <Route path="/login" element={<></>} />
              </>
            ) : (
              <>
              <Route path="/login" element={<Login auth={auth} setUser={(user: any) => setUser(user)} />} />

              <Route path="/" element={<></>} />
              <Route path="/yearlyReport" element={<></>} />
              <Route path="/totalReport" element={<></>} />
              <Route path="/accounts" element={<></>} />
              <Route path="/accountsReport" element={<></>} />
              <Route path="/addTransaction" element={<></>} />
              <Route path="/editTransaction/*" element={<></>} />
              <Route path="/editAccount/*" element={<></>} />
              <Route path="/milestones" element={<></>} />
              <Route path="/download" element={<></>} />
              <Route path="/transactionsView" element={<></>} />
              <Route path="/logout" element={<></>} />
              </>
            )}
          </Routes>
        </div>
      </BrowserRouter>
    </div>
  );
}

export default App;
