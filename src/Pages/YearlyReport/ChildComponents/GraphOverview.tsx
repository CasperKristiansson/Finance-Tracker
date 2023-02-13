import React from "react";
import { useNavigate } from "react-router-dom";
import { Grid, Segment } from "semantic-ui-react";
import { BarChart, BarChartStruct } from "../../../Component/BarChart";
import { LineChart, LineChartColor } from "../../../Component/LineChart";
import { MonthsLong } from "../../../Utils/Date";
import { GetLineChartValues, GetMonthOfYearAmount, Transaction } from "../../../Utils/Transactions";

export const GraphOverview: React.FC<{transactions: Transaction[], currentYear: number }> = ({ transactions, currentYear }): JSX.Element => {
	let navigate = useNavigate();

	return(
		<>
		<Grid columns={2}>
			<Grid.Row stretched>
				<Grid.Column>
					<Segment>
						<BarChart
							title={`Income / Expense for ${currentYear}`}
							height={undefined}
							data={{
								labels: MonthsLong,
								incomeData: transactions.length > 1 ? GetMonthOfYearAmount(transactions, "Income") : [],
								expenseData: transactions.length > 1 ? GetMonthOfYearAmount(transactions, "Expense") : [],
							} as BarChartStruct}
							customClickEvent={(_event: any, element: any) => {
								navigate(`/?year=${currentYear}&month=${element[0].index}&type=${element[0].datasetIndex === 1 ? "Income" : "Expense"}`);
							}}
						/>
					</Segment>
				</Grid.Column>
				<Grid.Column>
					<Segment>
						<LineChart
							title={`Wealth Growth for ${currentYear}`}
							data={{
								labels: MonthsLong,
								data: transactions.length > 1 ? GetLineChartValues(transactions).data : [],
							}}
							height={undefined}
							color={{} as LineChartColor}
							customClickEvent={(_event: any, element: any) => {
								navigate(`/?year=${currentYear}&month=${element[0].index}&type=Income}`);
							}}
						/>
					</Segment>
				</Grid.Column>
			</Grid.Row>
		</Grid>
		</>
	);
}
