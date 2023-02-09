import './App.css';

import Sidebar from './sidebar/sidebar';
import { Home } from './Pages/Home/Home';
import YearlyReport from './yearlyReport/yearlyReport';
import TotalReport from './totalReport/totalReport';
import { Accounts } from './Pages/Accounts/Accounts';
import { AccountsReport } from './Pages/AccountsReport/AccountsReport';
import AddTransaction from './transactions/addTransaction';
import EditTransaction from './transactions/editTransaction';
import EditAccount from './transactions/editAccount';
import { Milestones } from './Pages/Milestones/Milestones';
import { FloatingButton } from'./Pages/FloatingButton/FloatingButton';
import { Download } from './Pages/Download/Download';
import { Login } from './Pages/Login/Login';
import { Logout } from './Pages/Logout/Logout';

import { Route, Routes, BrowserRouter } from 'react-router-dom';
import { useEffect, useState } from 'react';

import './firebase.ts';

import { getAuth, onAuthStateChanged, setPersistence, browserLocalPersistence } from "firebase/auth";
import TransactionsView from './transactionsView/transactionsView';

import { createUseStyles } from "react-jss";

const useStyles = createUseStyles({
  mainSection: {
		paddingTop: 20,
		marginLeft: 270,
		padding: "100px 25px",
	},
});

function App() {
  const classes = useStyles();

  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [auth, setAuth] = useState(null);

  useEffect(() => {
    var authVar = getAuth()
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
              <Route path="/transactionsView" element={<TransactionsView userID={user.uid} />} />
              <Route path="/logout" element={<Logout logout={handleLogOut} />} />

              <Route path="/login" element={<></>} />
              </>
            ) : (
              <>
              <Route path="/login" element={<Login auth={auth} setUser={(user) => setUser(user)} />} />

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
        <br />
        <br />
        <br />
      </BrowserRouter>
    </div>
  );
}

export default App;
