import React, {useEffect, useState} from "react";
import { Grid, Segment, Divider } from "semantic-ui-react";
import LineChart from "../graphs/linechart";
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
				<Grid columns={2}>
					{accounts.map((account, index) => {
						return(
							<Grid.Column key={index}>
								<Segment className={`left aligned accountInformation ui ${account.Balance > 0 ? "green" : "red"} `}>
									<h3>{account.Title}</h3>
									<Divider inverted />
									<h4>Available Balance</h4>
									<h2>{account.Balance[account.Balance.length - 1].toLocaleString()}</h2>
									<LineChart
										title={"Balance"}
										labels={account.Labels}
										data={account.Balance}
									/>
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

	// Sort the transactions by date
	transactions.sort((a, b) => {
		return new Date(a.Date) - new Date(b.Date);
	});

	transactions.forEach(transaction => {
		if (transaction.Type === "Transfer-Out") {
			if (!accountNames.includes(transaction.Account)) {
				accountNames.push(transaction.Account);
				accounts.push({Title: transaction.Account, Balance: [-parseInt(transaction.Amount)], Labels: [formatDate(transaction.Date)]});
			} else {
				var index = accountNames.indexOf(transaction.Account);
				accounts[index].Balance.push(
					accounts[index].Balance[accounts[index].Balance.length - 1] - parseInt(transaction.Amount)
				);
				accounts[index].Labels.push(formatDate(transaction.Date));
			}

			if(!accountNames.includes(transaction.Category)) {
				accountNames.push(transaction.Category);
				accounts.push({Title: transaction.Category, Balance: [parseInt(transaction.Amount)], Labels: [formatDate(transaction.Date)]});
			} else {
				var index = accountNames.indexOf(transaction.Category);
				accounts[index].Balance.push(
					accounts[index].Balance[accounts[index].Balance.length - 1] + parseInt(transaction.Amount)
				);
				accounts[index].Labels.push(formatDate(transaction.Date));
			}
		}
		else {
			var transactionAmount = parseInt(transaction.Amount);
			if (transaction.Type === "Expense") {
				transactionAmount = -transactionAmount;
			}
				
			if (accountNames.includes(transaction.Account)) {
				var index = accountNames.indexOf(transaction.Account);
				accounts[index].Balance.push(
					accounts[index].Balance[accounts[index].Balance.length - 1] + transactionAmount
				);
				accounts[index].Labels.push(formatDate(transaction.Date));
			} else {
				accountNames.push(transaction.Account);
				accounts.push({Title: transaction.Account, Balance: [transactionAmount], Labels: [formatDate(transaction.Date)]});
			}
		}
	});

	accounts.forEach(account => {
		account.Balance = account.Balance.slice(Math.max(account.Balance.length - 40, 0));
		account.Labels = account.Labels.slice(Math.max(account.Labels.length - 40, 0));
	});

	// Only keep 5 labels and replace the other ones with empty strings
	accounts.forEach(account => {
		var labels = account.Labels;
		var labelsLength = labels.length;
		var labelsToKeep = 5;
		var labelsToRemove = labelsLength - labelsToKeep;
		var labelsToRemovePerLabel = Math.floor(labelsToRemove / labelsToKeep);

		var newLabels = [];
		var labelsRemoved = 0;
		labels.forEach((label, index) => {
			if (labelsRemoved < labelsToRemove) {
				if (index % (labelsToRemovePerLabel + 1) === 0) {
					newLabels.push(label);
				} else {
					newLabels.push("");
					labelsRemoved++;
				}
			} else {
				newLabels.push(label);
			}
		});

		account.Labels = newLabels;
	});

	return accounts;
}

function formatDate(date) {
	return date.split(" ")[0];
}
