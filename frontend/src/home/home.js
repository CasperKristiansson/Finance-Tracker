import React, {useEffect, useState} from "react";
import "./home.css";
import { Grid, Segment, Button } from "semantic-ui-react";
import PieChart from "../graphs/piechart";
import BarChart from "../graphs/barchart";
import Table from "../graphs/table";
import Banner from "./banner.js";

import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export default () => {
	const [yearIncome, setYearIncome] = useState([]);
	const [yearExpense, setYearExpense] = useState([]);
	const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
	const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
	const [transactions, setTransactions] = useState([]);
	const [categories, setCategories] = useState([]);
	const [categoriesIncome, setCategoriesIncome] = useState([]);
	const [categoriesExpense, setCategoriesExpense] = useState([]);

	useEffect(() => {
		const q = query(collection(db, "transactions"), where("date", ">", new Date(currentYear, 0, 1)));

		getDocs(q).then(querySnapshot => {
			setTransactions(querySnapshot.docs.map(doc => doc.data()));
		}, (error) => {
			console.log("Error getting documents: ", error);
		});
	}, [currentYear]);

	useEffect(() => {
		setYearIncome(getYearAmount(transactions, "Income"));
		setYearExpense(getYearAmount(transactions, "Expense"));
	}, [transactions]);

	useEffect(() => {
		setCategories(getCategories(transactions, new Date(currentYear, currentMonth - 1, 1), "Income"));
		// setCategoriesIncome(getCategories(transactions, "Income"));
		// setCategoriesExpense(getCategories(transactions, "Expense"));
	}, [transactions, currentMonth]);

	return (
		<>
		<div className={"main-section"}>
			<h1>Monthly Overview</h1>
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
										<Button color="red">Expenses</Button>
										<Button.Or />
										<Button positive>Income</Button>
									</Button.Group>
									<div className={"main-section-pie"}>
										<PieChart 
											title="Expenses"
											labels={["Food (25%)", "Transport", "Entertainment", "Other"]}
											data={[12, 19, 3, 5]}
										/>
									</div>
								</Segment>
						</Grid.Column>
					</Grid.Row>
				</Grid>
				<Segment style={{height: "200px"}}>
					<Banner />
					</Segment>
					<Table 
						data={[
							{
								date: "01/01/2020",
								category: "Food",
								amount: 200,
								account: "Checking",
								type: "Income",
								notes: "orem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad"
							},
							{
								date: "01/01/2020",
								category: "Food",
								amount: 200,
								account: "Checking",
								type: "Income",
								notes: "orem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad"
							},
							{
								date: "01/01/2020",
								category: "Food",
								amount: 200,
								account: "Checking",
								type: "Income",
								notes: "orem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad"
							},
							{
								date: "01/01/2020",
								category: "Food",
								amount: 200,
								account: "Checking",
								type: "Expense",
								notes: "orem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad"
							},
							{
								date: "01/01/2020",
								category: "Food",
								amount: 200,
								account: "Checking",
								type: "Income",
								notes: "orem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad"
							},
							{
								date: "01/01/2020",
								category: "Food",
								amount: 200,
								account: "Checking",
								type: "Expense",
								notes: "orem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad"
							},
							{
								date: "01/01/2020",
								category: "Food",
								amount: 200,
								account: "Checking",
								type: "Expense",
								notes: "orem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad"
							},
							{
								date: "01/01/2020",
								category: "Food",
								amount: 200,
								account: "Checking",
								type: "Income",
								notes: "orem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad"
							},
						]}
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
		let month = new Date(transactions[i].date.seconds * 1000).getMonth();

		if (transactions[i].type === type) {
			income[month] += transactions[i].amount;
		}
	}
	return income;
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