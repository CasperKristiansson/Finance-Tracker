import React, {useEffect, useState} from "react";
import "./home.css";
import { Grid, Segment, Button } from "semantic-ui-react";
import PieChart from "../graphs/piechart";
import BarChart from "../graphs/barchart";
import Table from "../graphs/table";
import Banner from "./banner.js";
import Header from "./header.js"

import { getDocs, collection } from "firebase/firestore";
import { db } from "../firebase";

import axios from 'axios';

export default () => {
	const [yearIncome, setYearIncome] = useState([]);
	const [yearExpense, setYearExpense] = useState([]);
	const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
	const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() - 1);
	const [transactions, setTransactions] = useState([]);
	const [categories, setCategories] = useState([]);
	const [categoriesAmount, setCategoriesAmount] = useState([]);

	const [pieChartType, setPieChartType] = useState("Income");

	var oldYear;

	useEffect(() => {
    if (currentYear !== oldYear) {
      var params = new URLSearchParams();
      params.append('year', currentYear);
      
      axios.post('https://pktraffic.com/api/transactions.php', params).then(response => {
        console.log(response.data);
      }).catch(response => {
        console.log(response);
      })

      if (oldYear !== currentYear) {
        oldYear = currentYear;
      }
    }
    
	}, [currentYear]);

	// useEffect(() => {
	// 	setYearIncome(getYearAmount(transactions, "Income", currentYear));
	// 	// setYearExpense(getYearAmount(transactions, "Expense", currentYear));
	// }, [transactions, currentYear]);

	// useEffect(() => {
	// 	setCategories(getCategories(transactions, new Date(currentYear, currentMonth, 1), pieChartType));
	// 	setCategoriesAmount(getCategoriesAmount(transactions, new Date(currentYear, currentMonth, 1), pieChartType));
	// }, [transactions, currentMonth, pieChartType]);

	// Handle the change of the year
	const handleYearChange = (e) => {
		if (e.target.value !== currentYear) {
			setCurrentYear(e.target.value);
		}
	}

	const handleMonthChange = (month) => {
		if (month >= 0 && month < 12 && month !== currentMonth) {
			setCurrentMonth(month);
		}
	}

	return (
		<>
		<div className={"main-section"}>
			{/* <Header
				handleYearChange={handleYearChange}
				handleMonthChange={handleMonthChange}
				currentMonth={currentMonth}
			/>
			<div className={"main-section-content"}>
				<Grid columns={2}>
					<Grid.Row stretched>
						<Grid.Column>
							<Grid columns={"equal"}>
								<Grid.Row>
									<Grid.Column>
										<Button
											icon="plus"
											content="Add Transaction"
											color="green"
											className={"main-section-button"}
										/>
									</Grid.Column>
									<Grid.Column>
										<Button
											icon="file"
											content="Import Excel"
											color="blue"
											className={"main-section-button"}
										/>
									</Grid.Column>
								</Grid.Row>
							</Grid>
							<Grid className={"grid-max-height"}>
								<Grid.Row stretched>
									<Grid.Column>
										<Segment>
											<BarChart
												title={currentYear}
												dataIncome={yearIncome}
												dataExpense={yearExpense}												
											/>
										</Segment>
									</Grid.Column>
								</Grid.Row>
							</Grid>
						</Grid.Column>
						<Grid.Column>
								<Segment>
									<Button.Group>
										<Button color="red" onClick={() => setPieChartType("Expense")}>Expenses</Button>
										<Button.Or />
										<Button positive onClick={() => setPieChartType("Income")}>Income</Button>
									</Button.Group>
									<div className={"main-section-pie"}>
										<PieChart 
											title={pieChartType}
											labels={categories}
											data={categoriesAmount}
										/>
									</div>
								</Segment>
						</Grid.Column>
					</Grid.Row>
				</Grid>
				<Segment style={{height: "200px"}}>
					<Banner income={yearIncome[currentMonth]} expenses={yearExpense[currentMonth]} />
					</Segment>
					<Table 
						data={filterTransactions(transactions, new Date(currentYear, currentMonth, 1))}
					/>
			</div> */}
		</div>
		</>
	);
}

function getYearAmount(transactionsGroup, type, currentYear) {
  // Get the amount of each month for the current year
  var yearAmount = [];
  for (var i = 0; i < 12; i++) {
    yearAmount.push(0);
  }

  console.log(transactionsGroup)

  // transactionsGroup.forEach((transactions) => {
    
  // });

  // console.log(yearAmount);

  return yearAmount;
}

function getCategories(transactions, date, type) {
	let categories = {};

	for (let i = 0; i < transactions.length; i++) {
		let dateCopy = new Date(date.getTime());
		if (transactions[i].date.seconds * 1000 >= date &&
			transactions[i].date.seconds * 1000 <= new Date(dateCopy.setMonth(dateCopy.getMonth() + 1)).getTime()) {
			if (transactions[i].type === type)
				if (categories[transactions[i].category]) categories[transactions[i].category] += transactions[i].amount;
				else categories[transactions[i].category] = transactions[i].amount;
		}
	}

	let categoriesTotal = 0;
	for (let i in categories) categoriesTotal += categories[i];

	let categoriesWithPercent = [];

	for (let i in categories) {
		categoriesWithPercent.push(i + " (" + (categories[i] / categoriesTotal * 100).toFixed(2) + "%)");
	}

	return categoriesWithPercent;
}

function getCategoriesAmount(transactions, date, type) {
	let categories = {};

	for (let i = 0; i < transactions.length; i++) {
		let dateCopy = new Date(date.getTime());
		if (transactions[i].date.seconds * 1000
			>= date &&
			transactions[i].date.seconds * 1000
			<= new Date(dateCopy.setMonth(dateCopy.getMonth() + 1)).getTime()) {
			if (transactions[i].type === type) {
				if (categories[transactions[i].category]) categories[transactions[i].category] += transactions[i].amount;
				else categories[transactions[i].category] = transactions[i].amount;
			}
		}
	}

	let categoriesTotal = 0;
	for (let i in categories) categoriesTotal += categories[i];

	let categoriesWithPercent = [];

	for (let i in categories) {
		categoriesWithPercent.push(categories[i]);
	}

	return categoriesWithPercent;
}

function convertData(transactionsData) {
  let transactionsDict = {};

  for(var i in transactionsData) {
    var transaction = {
      id: i,
      date: new Date(transactionsData[i][0].seconds * 1000),
      amount: transactionsData[i][1],
      category: transactionsData[i][2],
      description: transactionsData[i][3],
      account: transactionsData[i][4],
      type: transactionsData[i][5],
    }

    transactionsDict[i] = transaction;
  }

  return transactionsDict;
}

function filterTransactions(transactions, date) {
	let filteredTransactions = [];
	for (let i = 0; i < transactions.length; i++) {
		let dateCopy = new Date(date.getTime());
		if (transactions[i].date.seconds * 1000
			>= date &&
			transactions[i].date.seconds * 1000
			<= new Date(dateCopy.setMonth(dateCopy.getMonth() + 1)).getTime()) {
			filteredTransactions.push(transactions[i]);
		}
	}

	for (let i = 0; i < filteredTransactions.length; i++) {
		if (!filteredTransactions[i].note) {
			filteredTransactions[i].note = "";
		}
	}

	return filteredTransactions.reverse();
}