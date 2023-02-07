import React from "react";
import { createUseStyles } from "react-jss";
import { Grid, Segment, Button } from "semantic-ui-react";
import { useNavigate } from "react-router-dom";

import { MonthsShort, MonthYear } from "../../../Utils/Date";
import { ExcelUpload, ExcelUploadData } from "../../../Utils/Excel";
import PieChart from "../../../graphs/piechart";
import BarChart from "../../../graphs/barchart";
import { GetMonthOfYearAmount, Transaction, GetCategoriesLabels, GetCategoriesAmount } from "../../../Utils/Transactions";

const useStyles = createUseStyles({
	transactionButton: {
		width: "100%",
		height: 70,
	},
	gridMaxHeight: {
		height: "100%",
	},
	mainSectionPie: {
		marginLeft: "25%",
		marginRight: "25%",
	},
});

export const Overview: React.FC<{ userID: string, period: MonthYear, transactions: Transaction[] }> = ({ userID, period, transactions }): JSX.Element => {
	const classes = useStyles();
	let navigate = useNavigate();

	const [pieChartType, setPieChartType] = React.useState("Income");

	const handleExcelSubmit = () => {
		ExcelUpload(userID).then((data: ExcelUploadData) => {
			console.log(data);
		});
	};

	return(
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
									className={classes.transactionButton}
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
									className={classes.transactionButton}
									onClick={() => {
										handleExcelSubmit();
									}}
								/>
							</Grid.Column>
						</Grid.Row>
					</Grid>
					<Grid className={classes.gridMaxHeight}>
						<Grid.Row stretched>
							<Grid.Column>
								<Segment>
									<BarChart
										title={period.year}
										dataIncome={GetMonthOfYearAmount(transactions, "Income")}
										dataExpense={GetMonthOfYearAmount(transactions, "Expense")}	
										labels={MonthsShort}
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
							<div className={classes.mainSectionPie}>
								<PieChart 
									title={pieChartType}
									labels={GetCategoriesLabels(transactions, period.month, pieChartType)}
									data={GetCategoriesAmount(transactions, period.month, pieChartType)}
								/>
							</div>
						</Segment>
				</Grid.Column>
			</Grid.Row>
		</Grid>
	);
}
