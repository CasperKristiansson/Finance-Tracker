import React from "react";
import { Grid, Segment, Button } from "semantic-ui-react";
import BarChart from "../graphs/barchart";
import LineChart from "../graphs/linechart";
import PieChart from "../graphs/piechart";
import { transactions } from "../data.js";

export default (props) => {
	var year = 2021;

	return(
		<>
		<div className={"main-section"}>
			<div className={"main-section-content"}>
				<Grid columns={2}>
					<Grid.Row stretched>
						<Grid.Column>
							<Segment>
								<BarChart
									title={`Income / Expense for ${year}`}
									dataIncome={getTransactionsType(transactions, year, "Income")}
									dataExpense={getTransactionsType(transactions, year, "Expense")}
								/>
							</Segment>
						</Grid.Column>
						<Grid.Column>
							<Segment>
								<LineChart
									title={`Wealth Growth for ${year}`}
									data={calculateNetWorthIncrease(transactions, year)}
								/>
							</Segment>
						</Grid.Column>
					</Grid.Row>
				</Grid>
				<Grid columns={3}>
					<Grid.Row stretched>
						<Grid.Column>
							<Segment>
								<PieChart
									title={`Income`}
									labels={getCategories(transactions, year, "Income")}
									data={getTransactionAmounts(transactions, year, "Income")}
								/>
							</Segment>
						</Grid.Column>
						<Grid.Column>
							<Segment>
							</Segment>
						</Grid.Column>
						<Grid.Column>
							<Segment>
								<PieChart
									title={`Expense`}
									labels={getCategories(transactions, year, "Expense")}
									data={getTransactionAmounts(transactions, year, "Expense")}
								/>
							</Segment>
						</Grid.Column>
					</Grid.Row>
				</Grid>
			</div>
		</div>
		</>
	);
}

function getTransactionsType(transactions, year, type) {
	let map = new Map();
	transactions.forEach(transaction => {
		var currentDate = new Date(transaction.Date);
		if (transaction.Type == type && currentDate.getFullYear() == year) {
			var month = currentDate.getMonth();
			if (map.has(month)) {
				map.set(month, map.get(month) + transaction.Amount);
			} else {
				map.set(month, transaction.Amount);
			}
		}
	});

	return Array.from(map.values());
}

function calculateNetWorthIncrease(transactions, year) {
	let startAmount = 0;
	transactions.forEach(transaction => {
		var currentDate = new Date(transaction.Date);
		if (currentDate.getFullYear() < year) {
			if (transaction.Type == "Income") {
				startAmount += transaction.Amount;
			} else {
				startAmount -= transaction.Amount;
			}
		}
	});

	let map = new Map();
	transactions.forEach(transaction => {
		var currentDate = new Date(transaction.Date);
		if (currentDate.getFullYear() == year && transaction.Type != "Transfer-Out") {
			var month = currentDate.getMonth();
			if (transaction.Type == "Income") {
				var amount = transaction.Amount;
			} else if (transaction.Type == "Expense") {
				var amount = -transaction.Amount;
			}
			if (map.has(month)) {
				map.set(month, map.get(month) + amount);
			} else {
				map.set(month, amount);
			}
		}
	});

	let netWorthIncrease = [];
	netWorthIncrease.push(startAmount + map.get(0));
	for (let i = 1; i < 12; i++) {
		netWorthIncrease.push(netWorthIncrease[i - 1] + map.get(i));
	}

	return netWorthIncrease;
}

function getCategories(transactions, year, type) {
	let map = new Map();

	transactions.forEach(transaction => {
		var currentDate = new Date(transaction.Date);
		if (transaction.Type == type && currentDate.getFullYear() == year) {
			if (map.has(transaction.Category)) {
				map.set(transaction.Category, map.get(transaction.Category) + transaction.Amount);
			}
			else {
				map.set(transaction.Category, transaction.Amount);
			}
		}
	});

	let categoriesTotal = 0;
	map.forEach((value, key) => {
		categoriesTotal += value;
	});

	let categoriesWithPercent = [];
	map.forEach((value, key) => {
		categoriesWithPercent.push(
			key + " " + " (" + (value / categoriesTotal * 100).toFixed(2) + "%)"
		);
	});

	return categoriesWithPercent;
}

function getTransactionAmounts(transactions, year, type) {
	let map = new Map();
	transactions.forEach(transaction => {
		var currentDate = new Date(transaction.Date);
		if (transaction.Type == type && currentDate.getFullYear() == year) {
			if (map.has(transaction.Category)) {
				map.set(transaction.Category, map.get(transaction.Category) + transaction.Amount);
			}
			else {
				map.set(transaction.Category, transaction.Amount);
			}
		}
	});

	let amounts = [];
	map.forEach((value, key) => {
		amounts.push(value);
	});

	return amounts;
}
