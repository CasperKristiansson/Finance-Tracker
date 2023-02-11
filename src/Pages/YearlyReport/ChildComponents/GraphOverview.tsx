import React from "react";
import { Grid, Segment } from "semantic-ui-react";
import { BarChart, BarChartProps } from "../../../Component/Barchart";
import LineChart from "../../../graphs/linechart";
import { MonthsLong } from "../../../Utils/Date";
import { GetLineChartValues, GetMonthOfYearAmount, Transaction } from "../../../Utils/Transactions";

export const GraphOverview: React.FC<{transactions: Transaction[], currentYear: number }> = ({ transactions, currentYear }): JSX.Element => {
	return(
		<>
		<Grid columns={2}>
			<Grid.Row stretched>
				<Grid.Column>
					<Segment>
						<BarChart
							title={`Income / Expense for ${currentYear}`}
							height={undefined}
							barChart={{
								labels: MonthsLong,
								incomeData: transactions.length > 1 ? GetMonthOfYearAmount(transactions, "Income") : [],
								expenseData: transactions.length > 1 ? GetMonthOfYearAmount(transactions, "Expense") : [],
							} as BarChartProps}
						/>
					</Segment>
				</Grid.Column>
				<Grid.Column>
					<Segment>
						<LineChart
							title={`Wealth Growth for ${currentYear}`}
							data={[
								["", ...MonthsLong],
								transactions.length > 1 ? GetLineChartValues(transactions)[1] : [],
							]}
						/>
					</Segment>
				</Grid.Column>
			</Grid.Row>
		</Grid>
		</>
	);
}
