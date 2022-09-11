import React, {useEffect, useState} from "react";
import { Grid, Segment, Button } from "semantic-ui-react";
import BarChart from "../graphs/barchart";
import LineChart from "../graphs/linechart";
import PieChart from "../graphs/piechart";
import Table from "../graphs/tableMonth.js";


import axios from "axios";
import TableMonth from "../graphs/tableMonth.js";

var loansLineChart = {
	backgroundColorExpense: "rgba(255, 99, 132, 0.2)",
	borderColorExpense: "rgba(255,99,132,1)",
	hoverBackgroundColorExpense: "rgba(255, 99, 132, 0.4)",
	hoverBorderColorExpense: "rgba(255,99,132,1)",
	borderWidth: 1
}

export default (props) => {
  const [transactions, setTransactions] = useState([]);
	const [loans, setLoans] = useState([]);

	const [assetsData, setAssetsData] = useState({labels: [], data: []});
	const [loansData, setLoansData] = useState({labels: [], data: []});
	const [netWorthData, setNetWorthData] = useState({labels: [], data: []});

	var loadedTransactions = false;
	var loadedLoans = false;

	useEffect(() => {
		if (!loadedTransactions) {
			axios.get('https://pktraffic.com/api/transactionsTotal.php').then(response => {
				console.log(response.data);
				setTransactions(response.data.transactions);
				setAssetsData(calculateAssets(response.data.transactions));
			}).catch(response => {
				console.log(response);
			});

			loadedTransactions = true;
		}

		if (!loadedLoans) {
			axios.get('https://pktraffic.com/api/loans.php').then(response => {
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

	return(
		<>
		<div className={"main-section"}>
			<div className={"main-section-content"}>
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
