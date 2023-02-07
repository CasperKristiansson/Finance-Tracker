import React from "react";
import { createUseStyles } from "react-jss";
import { Grid, Segment, Button } from "semantic-ui-react";
import { useNavigate } from "react-router-dom";

import { MonthsShort } from "../../../Utils/Date";
import { ExcelUpload, ExcelUploadData } from "../../../Utils/excel";

const useStyles = createUseStyles({
});

export const Overview: React.FC<{ userID: string }> = ({ userID }): JSX.Element => {
	const classes = useStyles();
	let navigate = useNavigate();

	const handleExcelSubmit = () => {
		const excelUpload: ExcelUploadData = ExcelUpload(userID);
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
	);
}
