import React, {useEffect, useState} from "react";
import { Grid, Segment, Divider } from "semantic-ui-react";
import BarChart from "../graphs/barchart";
import LineChart from "../graphs/linechart";
import PieChart from "../graphs/piechart";
import HeatMap from "../graphs/heatmap";
import Table from "../graphs/tableMonth.js";
import axios from "axios";

import "./accounts.css";

export default (props) => {
	const [transactions, setTransactions] = useState([]);
	const [accounts, setAccounts] = useState([{Title: "Loading...", Balance: "Loading..."}]);
	var loadedTransactions = false;

	useEffect(() => {
		if (!loadedTransactions) {
			axios.get('https://pktraffic.com/api/transactionsTotal.php').then(response => {
				console.log(response.data);
				setTransactions(response.data.transactions);
			}).catch(response => {
				console.log(response);
			});

			loadedTransactions = true;
		}
	}, []);

	useEffect(() => {
		if (transactions.length > 0) {
			setAccounts(getAccounts(transactions));
		}
	}, [transactions]);
	
	return(
		<>
		<div className={"main-section"}>
			<div className={"main-section-content"}>
				<h1>Accounts</h1>
				<Grid columns={4}>
					{accounts.map((account, index) => {
						return(
							<Grid.Column key={index}>
								<Segment className="left aligned accountInformation">
									{/* Add a Randomized colored divider above the account.Title */}
									<h3>{account.Title}</h3>
									<Divider inverted />
									<h4>Available Balance</h4>
									<h2>{account.Balance}</h2>
								</Segment>
							</Grid.Column>
						);
					})}
				</Grid>
			</div>
		</div>
		</>
	);
};

function getAccounts(transactions) {
	var accounts = [];
	var accountNames = [];

	transactions.forEach(transaction => {
		if (transaction.Type === "Transfer-Out") {
			if (!accountNames.includes(transaction.Account)) {
				accountNames.push(transaction.Account);
				accounts.push({Title: transaction.Account, Balance: -parseInt(transaction.Amount)});
			} else {
				accounts[accountNames.indexOf(transaction.Account)].Balance -= parseInt(transaction.Amount);
			}

			if(!accountNames.includes(transaction.Category)) {
				accountNames.push(transaction.Category);
				accounts.push({Title: transaction.Category, Balance: parseInt(transaction.Amount)});
			} else {
				accounts[accountNames.indexOf(transaction.Category)].Balance += parseInt(transaction.Amount);
			}
		} else {
			if (accountNames.includes(transaction.Account)) {
				accounts[accountNames.indexOf(transaction.Account)].Balance += parseInt(transaction.Amount);
			} else {
				accountNames.push(transaction.Account);
				accounts.push({Title: transaction.Account, Balance: parseInt(transaction.Amount)});
			}
		}
	});

	console.log(accounts);

	return accounts;
}
