import React, {useEffect, useState} from "react";
import { Grid, Segment, Button } from "semantic-ui-react";
import BarChart from "../graphs/barchart";
import LineChart from "../graphs/linechart";
import PieChart from "../graphs/piechart";
import Header from "./headerYearReport.js"


import axios from "axios";

export default (props) => {
	const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [transactions, setTransactions] = useState([]);

  var oldYear;

	useEffect(() => {
    if (currentYear !== oldYear) {
      var params = new URLSearchParams();
      params.append('year', currentYear);
      
      axios.post('https://pktraffic.com/api/transactions.php', params).then(response => {
        console.log(response.data);
        setTransactions(response.data.transactions);
      }).catch(response => {
        console.log(response);
      })

      if (oldYear !== currentYear) {
        oldYear = currentYear;
      }
    }
    
	}, [currentYear]);

  useEffect(() => {
    netChange(transactions);
  }, [transactions]);

  const handleYearChange = (e) => {
		if (e.target.value !== currentYear) {
			setCurrentYear(e.target.value);
		}
	}

	return(
		<>
		<div className={"main-section"}>
      <Header
				handleYearChange={handleYearChange}
			/>
			<div className={"main-section-content"}>
				<Grid columns={2}>
					<Grid.Row stretched>
						<Grid.Column>
							<Segment>
								<BarChart
									title={`Income / Expense for ${currentYear}`}
									dataIncome={getTransactionsType(transactions, currentYear, "Income")}
									dataExpense={getTransactionsType(transactions, currentYear, "Expense")}
								/>
							</Segment>
						</Grid.Column>
						<Grid.Column>
							<Segment>
								<LineChart
									title={`Wealth Growth for ${currentYear}`}
									data={calculateNetWorthIncrease(transactions, currentYear)}
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
									labels={getCategories(transactions, currentYear, "Income")}
									data={getTransactionAmounts(transactions, currentYear, "Income")}
								/>
							</Segment>
						</Grid.Column>
						<Grid.Column>
							<Segment>
								<PieChart
									title={`Income / Expense`}
									labels={[`Income ${getPercent(transactions, currentYear, "Income")}`,
										`Expense ${getPercent(transactions, currentYear, "Expense")}`
									]}
									data={[
										getTotal(transactions, currentYear, "Income"),
										getTotal(transactions, currentYear, "Expense")
									]}
								/>
							</Segment>
						</Grid.Column>
						<Grid.Column>
							<Segment>
								<PieChart
									title={`Expense`}
									labels={getCategories(transactions, currentYear, "Expense")}
									data={getTransactionAmounts(transactions, currentYear, "Expense")}
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

function getTransactionsType(transactions, currentYear, type) {
	let map = new Map();
	transactions.forEach(transaction => {
		var currentDate = new Date(transaction.Date);
		if (transaction.Type == type) {
			var month = currentDate.getMonth();
			if (map.has(month)) {
				map.set(month, map.get(month) + parseInt(transaction.Amount));
			} else {
				map.set(month, parseInt(transaction.Amount));
			}
		}
	});

	return Array.from(map.values());
}

function calculateNetWorthIncrease(transactions, currentYear) {
	let startAmount = 0;
	transactions.forEach(transaction => {
		var currentDate = new Date(transaction.Date);
		if (currentDate.getFullYear() < currentYear) {
			if (transaction.Type == "Income") {
				startAmount += parseInt(transaction.Amount);
			} else {
				startAmount -= parseInt(transaction.Amount);
			}
		}
	});

	let map = new Map();
	transactions.forEach(transaction => {
		var currentDate = new Date(transaction.Date);
		if (currentDate.getFullYear() == currentYear && transaction.Type != "Transfer-Out") {
			var month = currentDate.getMonth();
			if (transaction.Type == "Income") {
				var amount = parseInt(transaction.Amount);
			} else if (transaction.Type == "Expense") {
				var amount = -parseInt(transaction.Amount);
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

function getCategories(transactions, currentYear, type) {
	let map = new Map();

	transactions.forEach(transaction => {
		var currentDate = new Date(transaction.Date);
		if (transaction.Type == type && currentDate.getFullYear() == currentYear) {
			if (map.has(transaction.Category)) {
				map.set(transaction.Category, map.get(transaction.Category) + parseInt(transaction.Amount));
			}
			else {
				map.set(transaction.Category, parseInt(transaction.Amount));
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

function getTransactionAmounts(transactions, currentYear, type) {
	let map = new Map();
	transactions.forEach(transaction => {
		var currentDate = new Date(transaction.Date);
		if (transaction.Type == type && currentDate.getFullYear() == currentYear) {
			if (map.has(transaction.Category)) {
				map.set(transaction.Category, map.get(transaction.Category) + parseInt(transaction.Amount));
			}
			else {
				map.set(transaction.Category, parseInt(transaction.Amount));
			}
		}
	});

	let amounts = [];
	map.forEach((value, key) => {
		amounts.push(value);
	});

	return amounts;
}

function getTotal(transactions, currentYear, type) {
	let total = 0;
	transactions.forEach(transaction => {
		var currentDate = new Date(transaction.Date);
		if (transaction.Type == type && currentDate.getFullYear() == currentYear) {
			total += parseInt(transaction.Amount);
		}
	});

	return total;
}

function getPercent(transactions, currentYear, type) {
	let total = 0;
	transactions.forEach(transaction => {
		var currentDate = new Date(transaction.Date);
		if (currentDate.getFullYear() == currentYear && transaction.Type != "Transfer-Out") {
			total += parseInt(transaction.Amount);
		}
	});

	let percent = 0;
	transactions.forEach(transaction => {
		var currentDate = new Date(transaction.Date);
		if (transaction.Type == type && currentDate.getFullYear() == currentYear) {
			percent += parseInt(transaction.Amount);
		}
	});

	return (percent / total * 100).toFixed(2) + "%";
}

function netChange(transactions) {
  let map = new Map();

  map.set("Income", {});
  map.set("Expense", {});
  map.set("NET", {});
  map.set("End Balance", {});

  for (let i = 0; i < 14; i++) {
    map.get("Income")[i] = 0;
    map.get("Expense")[i] = 0;
    map.get("NET")[i] = 0;
    map.get("End Balance")[i] = 0;
  }

  transactions.forEach(transaction => {
    var currentDate = new Date(transaction.Date);
    var month = currentDate.getMonth();
    if (transaction.Type == "Income") {
      map.get("Income")[month] += parseInt(transaction.Amount);
    } else if (transaction.Type == "Expense") {
      map.get("Expense")[month] += parseInt(transaction.Amount);
    }
  });

  for (let i = 0; i < 14; i++) {
    map.get("NET")[i] = map.get("Income")[i] - map.get("Expense")[i];
  }

  let endBalance = 0;
  for (let i = 0; i < 14; i++) {
    endBalance += map.get("NET")[i];
    map.get("End Balance")[i] = endBalance;
  }

  return map;
}
