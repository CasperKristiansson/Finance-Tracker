import React from "react";
import { createUseStyles } from "react-jss";
import { Grid, Segment, Button } from "semantic-ui-react";
import { useNavigate } from "react-router-dom";

import { MonthsLong, MonthYear } from "../../../Utils/Date";
import { ExcelUpload, ExcelUploadData } from "../../../Utils/Excel";
import PieChart from "../../../Component/PieChart";
import { BarChart } from "../../../Component/BarChart";
import { GetMonthOfYearAmount, Transaction, GetCategoriesLabels, GetCategoriesAmount, FilterTransactionsMonth, FilterTransactionsType } from "../../../Utils/Transactions";

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

export const Overview: React.FC<{ userID: string, period: MonthYear, transactions: Transaction[], handleMessage: any, pieChartType: string, setPieChartType: any, setPeriod: any }> = ({ userID, period, transactions, handleMessage, pieChartType, setPieChartType, setPeriod }): JSX.Element => {
	const classes = useStyles();
	let navigate = useNavigate();

	const handleExcelSubmit = () => {
		ExcelUpload(userID).then((data: ExcelUploadData) => {
			handleMessage(data)
		}).catch((data: ExcelUploadData) => {
			handleMessage(data)
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
										title={period.year.toString()}
										data={{
											labels: MonthsLong,
											incomeData: transactions.length > 1 ? GetMonthOfYearAmount(transactions, "Income") : [],
											expenseData: transactions.length > 1 ? GetMonthOfYearAmount(transactions, "Expense") : [],
										}}
										height={undefined}
										customClickEvent={(_event: any, element: any) => {
											setPieChartType(element[0].datasetIndex === 1 ? "Income" : "Expense");
											setPeriod({ year: period.year, month: element[0].index });
										}}
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
									data={{
										labels: GetCategoriesLabels(FilterTransactionsType(FilterTransactionsMonth(transactions, period.month), pieChartType)),
										data: GetCategoriesAmount(FilterTransactionsType(FilterTransactionsMonth(transactions, period.month), pieChartType)),
									}}
								/>
							</div>
						</Segment>
				</Grid.Column>
			</Grid.Row>
		</Grid>
	);
}
