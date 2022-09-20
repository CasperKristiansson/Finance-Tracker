import React, {useEffect, useState} from "react";
import "./home.css";
import { Grid, Segment, Button } from "semantic-ui-react";
import PieChart from "../graphs/piechart";
import BarChart from "../graphs/barchart";
import Table from "../graphs/table";
import Banner from "./banner.js";
import Header from "./header.js"
import { useNavigate } from "react-router-dom";

import { excel } from "xlsx";

import axios from 'axios';

export default (props) => {
	const [yearIncome, setYearIncome] = useState([]);
	const [yearExpense, setYearExpense] = useState([]);
	const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
	const [currentMonth, setCurrentMonth] = useState(getStartMonth());
	const [transactions, setTransactions] = useState([]);
	const [categories, setCategories] = useState([]);
	const [categoriesAmount, setCategoriesAmount] = useState([]);

	const [pieChartType, setPieChartType] = useState("Income");

	var oldYear;

	useEffect(() => {
    if (currentYear !== oldYear) {
      var params = new URLSearchParams();
      params.append('year', currentYear);
	  params.append('userID', props.userID);
      
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
		setYearIncome(getYearAmount(transactions, "Income"));
		setYearExpense(getYearAmount(transactions, "Expense"));
	}, [transactions, currentYear]);

	useEffect(() => {
		setCategories(getCategories(transactions, new Date(currentYear, currentMonth, 1), pieChartType));
		setCategoriesAmount(getCategoriesAmount(transactions, new Date(currentYear, currentMonth, 1), pieChartType));
	}, [transactions, currentMonth, pieChartType]);

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

	var XLSX = require("xlsx");

	const handleExcelSubmit = () => {
		var input = document.createElement('input');
		input.type = 'file';
		input.accept = '.xlsx';

		input.onchange = e => {
			var file = e.target.files[0];
			var reader = new FileReader();

			reader.readAsBinaryString(file);

			reader.onload = function (e) {
				var data = e.target.result;
				var workbook = XLSX.read(data, {
					type: 'binary'
				});
				var sheetName = workbook.SheetNames[0];
				var sheet = workbook.Sheets[sheetName];
				var data = XLSX.utils.sheet_to_json(sheet);

				data = validateData(data);

				var params = new URLSearchParams();
				params.append('transactions', JSON.stringify(data));
				params.append('userID', props.userID);

				axios.post('https://pktraffic.com/api/addTransactions.php', params).then(response => {
					console.log(response.data);
				}).catch(response => {
					console.log(response);
				})
			}
		}
		input.click();
	}

	let navigate = useNavigate();

	return (
		<>
		<div className={"main-section"}>
			<Header
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
											onClick={() => {
												navigate("/addTransaction");
											}}
										/>
									</Grid.Column>
									<Grid.Column>
										<Button
											icon="file"
											content="Import Excel"
											color="blue"
											className={"main-section-button"}
											onClick={() => {
												handleExcelSubmit();
											}}
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
												labels={["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]}
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
			</div>
		</div>
		</>
	);
}

function getYearAmount(transactions, type) {
	let income = [];
	for (let i = 0; i < 12; i++) {
		income.push(0);
	}

	for (let i = 0; i < transactions.length; i++) {
		let month = new Date(transactions[i].Date).getMonth();

		if (transactions[i].Type === type) {
			income[month] += parseInt(transactions[i].Amount);
		}
	}

	return income;
}

function getCategories(transactions, date, type) {
	let categories = {};

	for (let i = 0; i < transactions.length; i++) {
    let transactionDate = new Date(transactions[i].Date);
		
    if (transactionDate.getMonth() == date.getMonth() && transactions[i].Type == type) {
      if (!categories[transactions[i].Category]) {
        categories[transactions[i].Category] = parseInt(transactions[i].Amount);
      } else {
        categories[transactions[i].Category] += parseInt(transactions[i].Amount);
      }
    }
	}

  for (let category in categories) {
    if (categories[category] < 0) {
      delete categories[category];
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
    let transactionDate = new Date(transactions[i].Date);
		
    if (transactionDate.getMonth() == date.getMonth() && transactions[i].Type == type) {
      if (!categories[transactions[i].Category]) {
        categories[transactions[i].Category] = parseInt(transactions[i].Amount);
      } else {
        categories[transactions[i].Category] += parseInt(transactions[i].Amount);
      }
    }
	}

  for (let category in categories) {
    if (categories[category] < 0) {
      delete categories[category];
    }
  }

	let categoriesArray = [];

	for (let i in categories) {
		categoriesArray.push(categories[i]);
	}

	return categoriesArray;
}

function filterTransactions(transactions, date) {
	let filteredTransactions = [];
	for (let i = 0; i < transactions.length; i++) {
		var transactionDate = new Date(transactions[i].Date);

    if (transactionDate.getMonth() == date.getMonth()) {
      filteredTransactions.push(transactions[i]);
    }
	}

	for (let i = 0; i < filteredTransactions.length; i++) {
		if (!filteredTransactions[i].Description) {
			filteredTransactions[i].Description = "";
		}
	}

	// Sort the transactions on Date
	filteredTransactions.sort(function(a, b) {
		return new Date(b.Date) - new Date(a.Date);
	});

	return filteredTransactions;
}

function getStartMonth() {
	var startMonth = new Date().getMonth() - 1
	if (startMonth < 0) {
		return 0;
	} else {
		return startMonth;
	}
}

function validateData(data) {
	for(var i = 0; i < data.length; i++) {
		if (!data[i].hasOwnProperty("Date")) {
			data[i]["Date"] = "";
		}
		if (!data[i].hasOwnProperty("Type")) {
			data[i]["Type"] = "Not Specified";
		}
		if (!data[i].hasOwnProperty("Category")) {
			data[i]["Category"] = "Not Specified";
		}
		if (!data[i].hasOwnProperty("Amount")) {
			data[i]["Amount"] = "0";
		}
		if (!data[i].hasOwnProperty("Description")) {
			data[i]["Description"] = "Not Specified";
		}
		if (!data[i].hasOwnProperty("Account")) {
			data[i]["Account"] = "Not Specified";
		}

		var date = new Date(data[i]["Date"]);
		var year = date.getFullYear();
		var month = date.getMonth() + 1;
		var day = date.getDate();
		var hour = date.getHours();
		var minute = date.getMinutes();
		var second = date.getSeconds();

		data[i]["Date"] = year + "-" + month + "-" + day + " " + hour + ":" + minute + ":" + second;
	}

	return data;
}