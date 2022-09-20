import React, {useEffect, useState} from "react";
import { Grid, Segment, Button } from "semantic-ui-react";
import BarChart from "../graphs/barchart";
import LineChart from "../graphs/linechart";
import PieChart from "../graphs/piechart";
import HeatMap from "../graphs/heatmap";
import Table from "../graphs/tableMonth.js";

import axios from "axios";
import TableMonth from "../graphs/tableMonth.js";
import tableCustom from "../graphs/tableCustom";
import TableCustom from "../graphs/tableCustom";

var loansLineChart = {
	backgroundColorExpense: "rgba(255, 99, 132, 0.2)",
	borderColorExpense: "rgba(255,99,132,1)",
	hoverBackgroundColorExpense: "rgba(255, 99, 132, 0.4)",
	hoverBorderColorExpense: "rgba(255,99,132,1)",
	borderWidth: 2
}

var netWorthLineChart = {
	backgroundColorExpense: "rgba(50, 155, 0, 0.2)",
	borderColorExpense: "rgba(50, 155, 0, 1)",
	hoverBackgroundColorExpense: "rgba(50, 155, 0, 0.4)",
	hoverBorderColorExpense: "rgba(50, 155, 0, 1)",
	borderWidth: 2
}

var heatMapIncomeColors = [
	{
		from: -1000000,
		to: -1,
		name: '0 <',
		color: '#F15B46'
	},
	{
		from: 0,
		to: 10000,
		name: '0 - 10k',
		color: '#6DC47B'
	},
	{
		from: 10000,
		to: 30000,
		name: '10k - 30k',
		color: '#54A979'
	},
	{
		from: 30000,
		to: 50000,
		name: '30k - 50k',
		color: '#3E8D76'
	},
	{
		from: 50000,
		to: 100000,
		name: '50k - 100k',
		color: '#2B7271'
	},
	{
		from: 100000,
		to: 2000000,
		name: '100k <',
		color: '#18472b'
	},						
]

var heatMapExpenseColors = [
	{
		from: 0,
		to: 4000,
		name: '0 - 4k',
		color: '#EE4540'
	},
	{
		from: 4000,
		to: 10000,
		name: '4k - 10k',
		color: '#C72B41'
	},
	{
		from: 10000,
		to: 15000,
		name: '10k - 15k',
		color: '#800834'
	},
	{
		from: 15000,
		to: 20000,
		name: '15k - 20k',
		color: '#530332'
	},
	{
		from: 20000,
		to: 4000000,
		name: '20k <',
		color: '#2E122D'
	},
]

export default (props) => {
  const [transactions, setTransactions] = useState([]);
	const [loans, setLoans] = useState([]);

	const [assetsData, setAssetsData] = useState({labels: [], data: []});
	const [loansData, setLoansData] = useState({labels: [], data: []});
	const [netWorthData, setNetWorthData] = useState({labels: [], data: []});

	const [barChartData, setBarChartData] = useState({labels: [], income: [], expenses: []});

	const [tableIncome, setTableIncome] = useState(new Map());
	const [tableExpense, setTableExpense] = useState(new Map());
	const [tableCategoriesIncome, setTableCategoriesIncome] = useState(new Map());
	const [tableCategoriesExpense, setTableCategoriesExpense] = useState(new Map());


	var loadedTransactions = false;
	var loadedLoans = false;


	useEffect(() => {
		if (!loadedTransactions) {
			var params = new URLSearchParams();
			params.append('userID', props.userID);

			axios.post('https://pktraffic.com/api/transactionsTotal.php', params).then(response => {
				console.log(response.data);
				setTransactions(response.data.transactions);
			}).catch(response => {
				console.log(response);
			});

			loadedTransactions = true;
		}

		if (!loadedLoans) {
			var params = new URLSearchParams();
			params.append('userID', props.userID);

			axios.post('https://pktraffic.com/api/loans.php', params).then(response => {
				console.log(response.data);
				setLoans(response.data.transactions);
				setLoansData(calculateLoans(response.data.transactions));
			}).catch(response => {
				console.log(response);
			});

			loadedLoans = true;
		}
	}, []);
	

	useEffect(() => {
		if (transactions.length > 0 && loans.length > 0) {
			setNetWorthData(calculateNetWorth(transactions, loans));
		}
	}, [transactions, loans]);

	useEffect(() => {
		var data = calculateBarChart(transactions);
		setBarChartData(data);	
		
		setTableIncome(transactionType(transactions, "Income"));
		setTableExpense(transactionType(transactions, "Expense"));

		setTableCategoriesIncome(transactionCategories(transactions, "Income"));
		setTableCategoriesExpense(transactionCategories(transactions, "Expense"));

	}, [transactions]);

	return(
		<>
		<div className={"main-section"}>
			<div className={"main-section-content"}>
				<Grid columns={3}>
					<Grid.Row stretched>
						<Grid.Column>
							<Segment>
								<h3 className="ui green header">Net Worth</h3>
								<h1 className="ui green header">{numberWithCommas(netWorthData.data[netWorthData.data.length - 1])} kr</h1>
							</Segment>
						</Grid.Column>
						<Grid.Column>
							<Segment>
								<h3 className="ui red header">Total Loans</h3>
								<h1 className="ui red header">{numberWithCommas(loansData.data[loansData.data.length - 1])} kr</h1>
							</Segment>
						</Grid.Column>
						<Grid.Column>
							<Segment>
								<h3 className="ui blue header">Total Assets</h3>
								<h1 className="ui blue header">{numberWithCommas(assetsData.data[assetsData.data.length - 1])} kr</h1>
							</Segment>
						</Grid.Column>
					</Grid.Row>
				</Grid>
				<Grid columns={2}>
					<Grid.Row stretched>
						<Grid.Column>
							<Segment>
								<LineChart
									title={`Assets`}
									data={assetsData.data}
									labels={assetsData.labels}
								/>
							</Segment>
						</Grid.Column>
						<Grid.Column>
							<Segment>
								<LineChart
									title={`Loans`}
									data={loansData.data}
									labels={loansData.labels}
									colors={loansLineChart}
								/>
							</Segment>
						</Grid.Column>
					</Grid.Row>
				</Grid>
				<Grid columns={1}>
					<Grid.Column>
						<Segment>
							<LineChart
								title={`Net Worth`}
								data={netWorthData.data}
								labels={netWorthData.labels}
								height={80}
								colors={netWorthLineChart}
							/>
						</Segment>
					</Grid.Column>
				</Grid>
				<Grid columns={1}>
					<Grid.Column>
						<Segment>
							<BarChart
								title={`Income vs Expenses`}
								labels={barChartData.labels}
								dataIncome={barChartData.income}
								dataExpense={barChartData.expenses}
								height={75}
							/>
						</Segment>
					</Grid.Column>
				</Grid>
				<Grid columns={3}>
					<Grid.Row stretched>
						<Grid.Column>
							<Segment>
								<PieChart
									title={`Income`}
									labels={getCategories(transactions, "Income")}
									data={getTransactionAmounts(transactions, "Income")}
								/>
							</Segment>
						</Grid.Column>
						<Grid.Column>
							<Segment>
								<PieChart
									title={`Income / Expense`}
									labels={[`Income ${getPercent(transactions, "Income")}`,
										`Expense ${getPercent(transactions, "Expense")}`
									]}
									data={[
										getTotal(transactions, "Income"),
										getTotal(transactions, "Expense")
									]}
								/>
							</Segment>
						</Grid.Column>
						<Grid.Column>
							<Segment>
								<PieChart
									title={`Expense`}
									labels={getCategories(transactions, "Expense")}
									data={getTransactionAmounts(transactions, "Expense")}
								/>
							</Segment>
						</Grid.Column>
					</Grid.Row>
				</Grid>
				<Grid columns={2}>
					<Grid.Row stretched>
						<Grid.Column>
							<Segment>
								<HeatMap
									title={`Income`}
									data={getHeatMapData(transactions, "Income")}
									color={heatMapIncomeColors}
								/>
							</Segment>
						</Grid.Column>
						<Grid.Column>
							<Segment>
								<HeatMap
									title={`Expense`}
									data={getHeatMapData(transactions, "Expense")}
									color={heatMapExpenseColors}
								/>
							</Segment>
						</Grid.Column>
					</Grid.Row>
				</Grid>
				<Segment>
					<h1>Income</h1>
					<TableMonth 
						data={tableIncome}
						color={"green"}
						type={""}
					/>
				</Segment>
				<Segment>
					<h1>Expenses</h1>
					<TableMonth
						data={tableExpense}
						color={"red"}
						type={""}
					/>
				</Segment>
				<Segment>
					<h1>Income Categories</h1>
					<TableCustom
						data={tableCategoriesIncome}
						color={"green"}
						type={""}
					/>
				</Segment>
				<Segment>
					<h1>Expense Categories</h1>
					<TableCustom
						data={tableCategoriesExpense}
						color={"red"}
						type={""}
					/>
				</Segment>
			</div>
		</div>
		</>
	);
}

function calculateAssets(transactions) {
	let assetsMap = new Map();

	let firstDate = getFirstTransactionDate(transactions);
	let currentDate = new Date();
	let currentMonth = currentDate.getMonth();
	let currentYear = currentDate.getFullYear();

	let month = firstDate.getMonth();
	let year = firstDate.getFullYear();

	while (year < currentYear || (year === currentYear && month <= currentMonth)) {
		let date = new Date(year, month, 1);
		let dateString = date.getFullYear() + "-" + (date.getMonth() + 1);
		assetsMap.set(dateString, 0);
		month++;
		if (month > 11) {
			month = 0;
			year++;
		}
	}

	for (let i = 0; i < transactions.length; i++) {
		let date = new Date(transactions[i].Date);
		let year = date.getFullYear();
		let month = date.getMonth() + 1;
		let key = year + "-" + month;
	
		let value = assetsMap.get(key);
		if (isNaN(transactions[i].Amount)) {
			continue;
		}

		if (transactions[i].Type === "Expense") {
			value -= parseInt(transactions[i].Amount);
		} else if (transactions[i].Type === "Income") {
			value += parseInt(transactions[i].Amount);
		} else {
			continue;
		}
		assetsMap.set(key, value);
	}

	let assets = [];
	let labels = [];

	assetsMap.forEach((value, key) => {
		if (assets.length === 0) {
			assets.push(value);
		} else {
			assets.push(value + assets[assets.length - 1]);
		}
		labels.push(key);
	});

	// With the labels only keep a maximum of 10 labels. This means that we only show¨
	// a maximum of 10 labels on the x-axis.
	if (labels.length > 10) {
		let step = Math.floor(labels.length / 10);
		// It is important that if a label is not shown that a empty string is added
		// to the labels array. This is because the labels array and the data array
		// must have the same length.
		for (let i = 0; i < labels.length; i++) {
			if (i % step !== 0) {
				labels[i] = "";
			}
		}
	}

	return {
		labels: labels,
		data: assets
	};
}

function getFirstTransactionDate(transactions) {
	if (transactions.length === 0) {
		return new Date();
	}

	let firstDate = new Date(transactions[0].Date);
	for (let i = 1; i < transactions.length; i++) {
		let date = new Date(transactions[i].Date);
		if (date < firstDate) {
			firstDate = date;
		}
	}

	return firstDate;
}

function calculateLoans(loans) {
	var data = []
	var labels = []

	for (let i = 0; i < loans.length; i++) {
		if (i === 0) {
			data.push(parseInt(loans[i].amount));
		} else {
			data.push(parseInt(loans[i].amount) + data[i-1]);
		}
		
		// Convert the date string from 2021-01-01 to 2021-1, or 2021-10-09 to 2021-10
		let date = loans[i].date.split("-");
		labels.push(date[0] + "-" + parseInt(date[1]));

	}

	// With the labels only keep a maximum of 10 labels. This means that we only show¨
	// a maximum of 10 labels on the x-axis.
	if (labels.length > 10) {
		let step = Math.floor(labels.length / 10);
		// It is important that if a label is not shown that a empty string is added
		// to the labels array. This is because the labels array and the data array
		// must have the same length.
		for (let i = 0; i < labels.length; i++) {
			if (i % step !== 0) {
				labels[i] = "";
			}
		}
	}

	return {
		labels: labels,
		data: data
	};
}

function calculateNetWorth(transactions, loans) {
	let assetsMap = new Map();

	let firstDate = getFirstTransactionDate(transactions);
	let currentDate = new Date();
	let currentMonth = currentDate.getMonth();
	let currentYear = currentDate.getFullYear();

	let month = firstDate.getMonth();
	let year = firstDate.getFullYear();

	while (year < currentYear || (year === currentYear && month <= currentMonth)) {
		let date = new Date(year, month, 1);
		let dateString = date.getFullYear() + "-" + (date.getMonth() + 1);
		assetsMap.set(dateString, 0);
		month++;
		if (month > 11) {
			month = 0;
			year++;
		}
	}
	
	for (let i = 0; i < transactions.length; i++) {
		let date = new Date(transactions[i].Date);
		let year = date.getFullYear();
		let month = date.getMonth() + 1;
		let key = year + "-" + month;
	
		let value = assetsMap.get(key);
		if (isNaN(transactions[i].Amount)) {
			continue;
		}

		if (transactions[i].Type === "Expense") {
			value -= parseInt(transactions[i].Amount);
		} else if (transactions[i].Type === "Income") {
			value += parseInt(transactions[i].Amount);
		} else {
			continue;
		}
		assetsMap.set(key, value);
	}

	for (let i = 0; i < loans.length; i++) {
		let date = new Date(loans[i].date);
		let year = date.getFullYear();
		let month = date.getMonth() + 1;
		let key = year + "-" + month;
	
		let value = assetsMap.get(key);
		if (isNaN(loans[i].amount)) {
			continue;
		}
		value -= parseInt(loans[i].amount);
		assetsMap.set(key, value);
	}

	let assets = [];
	let labels = [];

	assetsMap.forEach((value, key) => {
		if (assets.length === 0) {
			assets.push(value);
		} else {
			assets.push(value + assets[assets.length - 1]);
		}
		labels.push(key);
	});

	// With the labels only keep a maximum of 10 labels. This means that we only show¨
	// a maximum of 10 labels on the x-axis.
	if (labels.length > 20) {
		let step = Math.floor(labels.length / 20);
		// It is important that if a label is not shown that a empty string is added
		// to the labels array. This is because the labels array and the data array
		// must have the same length.
		for (let i = 0; i < labels.length; i++) {
			if (i % step !== 0) {
				labels[i] = "";
			}
		}
	}

	return {
		labels: labels,
		data: assets
	};
}

function getCategories(transactions, type) {
	let map = new Map();

	transactions.forEach(transaction => {
		var currentDate = new Date(transaction.Date);
		if (transaction.Type == type) {
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

function getTransactionAmounts(transactions, type) {
	let map = new Map();
	transactions.forEach(transaction => {
		if (transaction.Type == type) {
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

function getTotal(transactions, type) {
	let total = 0;
	transactions.forEach(transaction => {
		var currentDate = new Date(transaction.Date);
		if (transaction.Type == type) {
			total += parseInt(transaction.Amount);
		}
	});

	return total;
}

function getPercent(transactions, type) {
	let total = 0;
	transactions.forEach(transaction => {
		var currentDate = new Date(transaction.Date);
		if (transaction.Type != "Transfer-Out") {
			total += parseInt(transaction.Amount);
		}
	});

	let percent = 0;
	transactions.forEach(transaction => {
		var currentDate = new Date(transaction.Date);
		if (transaction.Type == type) {
			percent += parseInt(transaction.Amount);
		}
	});

	return (percent / total * 100).toFixed(2) + "%";
}

function getHeatMapData(transactions, type) {
	let assetsMap = new Map();

	let firstDate = getFirstTransactionDate(transactions);
	let currentDate = new Date();
	let currentMonth = currentDate.getMonth();
	let currentYear = currentDate.getFullYear();

	let month = 0;
	let year = firstDate.getFullYear();

	while (year < currentYear || (year === currentYear && month <= currentMonth)) {
		let date = new Date(year, month, 1);
		let dateString = date.getFullYear() + "-" + (date.getMonth() + 1);
		assetsMap.set(dateString, 0);
		month++;
		if (month > 11) {
			month = 0;
			year++;
		}
	}

	for (let i = 0; i < transactions.length; i++) {
		let date = new Date(transactions[i].Date);
		let year = date.getFullYear();
		let month = date.getMonth() + 1;
		let key = year + "-" + month;
	
		let value = assetsMap.get(key);
		if (isNaN(transactions[i].Amount)) {
			continue;
		}
		if (transactions[i].Type === type) {
			value += parseInt(transactions[i].Amount);
		}

		assetsMap.set(key, value);
	}

	let heatMap = [];

	assetsMap.forEach((value, key) => {
		// get the key month
		let month = parseInt(key.split("-")[1]);
		// get the key year
		let year = parseInt(key.split("-")[0]);
		// Check if heatmap already has a value for this month in the format where heatMap = [{name: month}]
		let monthExists = false;
		for (let i = 0; i < heatMap.length; i++) {
			if (heatMap[i].name === month) {
				// if value is 0 replace it with null
				if (value === 0) {
					heatMap[i].data.push({x: year, y: value});
				} else {
					heatMap[i].data.push({x: year, y: value});
				}
				monthExists = true;
				break;
			}
		}
		// If the month does not exist in the heatmap then add it.
		if (!monthExists) {
			// if value is 0 replace it with null
			if (value === 0) {
				heatMap.push({ name: month, data: [{x: year, y: value}] });
			} else {
				heatMap.push({ name: month, data: [{x: year, y: value}] });
			}
		}
	});

	// sort it by month 
	heatMap.sort((a, b) => {
		return b.name - a.name;	
	});

	// Replace the number of the month with the name of the month.
	for (let i = 0; i < heatMap.length; i++) {
		heatMap[i].name = getMonthName(heatMap[i].name);
	}

	return heatMap;
}

function getMonthName(month) {
	switch (month) {
		case 1:
			return "January";
		case 2:
			return "February";
		case 3:
			return "March";
		case 4:
			return "April";
		case 5:
			return "May";
		case 6:
			return "June";
		case 7:
			return "July";
		case 8:
			return "August";
		case 9:
			return "September";
		case 10:
			return "October";
		case 11:
			return "November";
		case 12:
			return "December";
	}
}

function numberWithCommas(x) {
	if (x === undefined) {
		return "0";
	}

	return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function calculateBarChart(transactions) {
	// Return a data item containing three items. One array of the years. One for the income that year and one for the expenses that year.
	let years = new Map();
	let income = new Map();
	let expenses = new Map();
	
	// iterate through the transactions
	for (let i = 0; i < transactions.length; i++) {
		// Add the year to the map if it does not exist.
		let date = new Date(transactions[i].Date);
		let year = date.getFullYear();
		if (!years.has(year)) {
			years.set(year, 0);
		}

		// Add the amount to the income or expenses array.
		if (transactions[i].Type === "Income") {
			if (!income.has(year)) {
				income.set(year, 0);
			}
			income.set(year, income.get(year) + parseInt(transactions[i].Amount));
		} else if (transactions[i].Type === "Expense") {
			if (!expenses.has(year)) {
				expenses.set(year, 0);
			}
			expenses.set(year, expenses.get(year) + parseInt(transactions[i].Amount));
		}
	}

	// Create the data object.
	let data = {
		labels: [],
		income: [],
		expenses: []
	};

	// Add the years to the data object.
	years.forEach((value, key) => {
		data.labels.push(key);
	});

	// Add the income to the data object.
	income.forEach((value, key) => {
		data.income.push(value);
	});

	// Add the expenses to the data object.
	expenses.forEach((value, key) => {
		data.expenses.push(value);
	});

	return data;
}

function transactionType(transactions, type) {
  var yearMap = new Map();

	for (let i = 0; i < transactions.length; i++) {
		let date = new Date(transactions[i].Date);
		let year = date.getFullYear();
		if (!yearMap.has(year)) {
			yearMap.set(year, 0);
		}
	}

	var years = [];

	yearMap.forEach((value, key) => {
		years.push(key);
	});

  let map = new Map();

  years.forEach(year => {
    map.set(year, {});
  });

  for (let i = 0; i < 14; i++) {
    map.forEach((value, key) => {
      map.get(key)[i] = 0;
    });
  }

  transactions.forEach(transaction => {
    var currentDate = new Date(transaction.Date);
    var month = currentDate.getMonth();
    if (transaction.Type == type) {
      map.get(currentDate.getFullYear())[month] += parseInt(transaction.Amount);
    }
  });
  
  map.forEach((value, key) => {
    let total = 0;
    for (let i = 0; i < 12; i++) {
      total += map.get(key)[i];
    }
    map.get(key)[12] = total;
    map.get(key)[13] = total / 12;
  });

  map.set("Total", {});
  
  for (let i = 0; i < 14; i++) {
    let total = 0;
    map.forEach((value, key) => {
      if (map.get(key)[i] != undefined) {
        total += map.get(key)[i];
      }
    });

    map.get("Total")[i] = total;
  }

	map.set("Average", {});

	for (let i = 0; i < 14; i++) {
		map.get("Average")[i] = map.get("Total")[i] / map.size;
	}

  let obj = {};
  map.forEach((value, key) => {
    obj[key] = value;
  });

  return obj;
}

function transactionCategories(transactions, type) {
  var categories = []

  transactions.forEach(transaction => {
    if (transaction.Type == type) {
      categories.push(transaction.Category);
    }
  });

  let map = new Map();

  categories.forEach(category => {
    map.set(category, {});
  });

  // Get how many different years there are.
	var yearMap = new Map();

	for (let i = 0; i < transactions.length; i++) {
		let date = new Date(transactions[i].Date);
		let year = date.getFullYear();
		if (!yearMap.has(year)) {
			yearMap.set(year, 0);
		}
	}
	
	// Get the length of the years map.
	var years = [];
	yearMap.forEach((value, key) => {
		years.push(key);
	});

	years.forEach(year => {
		map.forEach((value, key) => {
			map.get(key)[year] = 0;
		});
	});

	map.forEach((value, key) => {
		map.get(key)["Total"] = 0;
		map.get(key)["Average"] = 0;
	});

  transactions.forEach(transaction => {
    var currentDate = new Date(transaction.Date);
    var year = currentDate.getFullYear();
    if (transaction.Type == type) {
      map.get(transaction.Category)[year] += parseInt(transaction.Amount);
    }
  });

  map.forEach((value, key) => {
    let total = 0;
    years.forEach(year => {
			total += map.get(key)[year];
		});
		map.get(key)["Total"] = total;
		map.get(key)["Average"] = total / years.length;
  });

  map.set("Total", {});
  
  years.forEach(year => {
		let total = 0;
		map.forEach((value, key) => {
			if (map.get(key)[year] !== undefined) {
				total += map.get(key)[year];
			}
		});
		map.get("Total")[year] = total;
	});

	let total = 0;
	map.forEach((value, key) => {
		if (map.get(key)["Total"] !== undefined) {
			total += map.get(key)["Total"];
		}
	});
	map.get("Total")["Total"] = total;
	map.get("Total")["Average"] = total / years.length;

	// Make sure that every single value in the map is toFixed(1)
	map.forEach((value, key) => {
		years.forEach(year => {
			map.get(key)[year] = map.get(key)[year].toFixed(1);
		});
		map.get(key)["Total"] = map.get(key)["Total"].toFixed(1);
		map.get(key)["Average"] = map.get(key)["Average"].toFixed(1);
	});

  let obj = {};
  map.forEach((value, key) => {
    obj[key] = value;
  });

  return obj;
}
