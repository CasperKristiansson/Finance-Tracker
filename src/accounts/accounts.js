import React, {useEffect, useState} from "react";
import { Grid, Segment, Divider, Button, Icon, Header } from "semantic-ui-react";
import BarChart from "../graphs/barchart";
import LineChart from "../graphs/linechart";
import PieChart from "../graphs/piechart";
import HeatMap from "../graphs/heatmap";
import Table from "../graphs/tableMonth.js";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import "./accounts.css";

export default (props) => {
	const [transactions, setTransactions] = useState([]);
	const [accounts, setAccounts] = useState([{Title: "Loading...", Balance: "Loading..."}]);
	var loadedTransactions = false;

	let navigate = useNavigate();

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
								<Segment className={`left aligned accountInformation ui ${account.Balance >= 0 ? "green" : "red"} `}>
									<Button icon
										floated="right"
										size="mini"
										color="gray"
										onClick={() => navigate(`/editAccount/?account=${account.Title}&balance=${account.Balance}`)}
									>
										<Icon name="edit" />
									</Button>
									<Header size="medium" floated="left">{account.Title}</Header>
									<br />
									<Divider inverted />
									<h4>Available Balance</h4>
									<h2>{account.Balance.toLocaleString()}</h2>
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
		}
		else {
			var transactionAmount = parseInt(transaction.Amount);
			if (transaction.Type === "Expense") {
				transactionAmount = -transactionAmount;
			}
				
			if (accountNames.includes(transaction.Account)) {
				accounts[accountNames.indexOf(transaction.Account)].Balance += transactionAmount;
			} else {
				accountNames.push(transaction.Account);
				accounts.push({Title: transaction.Account, Balance: transactionAmount});
			}
		}
	});

	return accounts;
}
