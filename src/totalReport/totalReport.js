import React, {useEffect, useState} from "react";
import { Grid, Segment, Button } from "semantic-ui-react";
import BarChart from "../graphs/barchart";
import LineChart from "../graphs/linechart";
import PieChart from "../graphs/piechart";
import Table from "../graphs/tableMonth.js";


import axios from "axios";
import TableMonth from "../graphs/tableMonth.js";

export default (props) => {
  const [transactions, setTransactions] = useState([]);

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
									data={calculateAssets(transactions)}
								/>
							</Segment>
						</Grid.Column>
						<Grid.Column>
							<Segment>
								{/* <LineChart
									title={`Loans`}
									data={calculateLoads(transactions)}
								/> */}
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

	console.log(assetsMap);

	for (let i = 0; i < transactions.length; i++) {
		let date = new Date(transactions[i].Date);
		let year = date.getFullYear();
		let month = date.getMonth() + 1;
		let key = year + "-" + month;
	
		let value = assetsMap.get(key);
		if (isNaN(transactions[i].Amount)) {
			continue;
		}
		value += parseInt(transactions[i].Amount);
		assetsMap.set(key, value);
	}

	let assets = [];
	let labels = [];

	assetsMap.forEach((value, key) => {
		assets.push(value);
		labels.push(key);
	});

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
