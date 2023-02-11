import { Grid, Segment } from "semantic-ui-react";
import BarChart from "../../../graphs/barchart";
import LineChart from "../../../graphs/linechart";
import { LoansLineChart, NetWorthLineChart } from "../../../Utils/Data/Linechart";
import { MonthsLong, MonthsShort } from "../../../Utils/Date";
import { ConvertLoansToTransactions, GetLineChartValues, GetMonthOfYearAmount, Loan, Transaction } from "../../../Utils/Transactions";

export const GraphOverview: React.FC<{transactions: Transaction[], currentYear: number }> = ({ transactions, currentYear }): JSX.Element => {
	return(
		<>
		<Grid columns={2}>
			<Grid.Row stretched>
				<Grid.Column>
					<Segment>
						<BarChart
							title={`Income / Expense for ${currentYear}`}
							data={[
								MonthsLong,
								transactions.length > 1 ? GetMonthOfYearAmount(transactions, "Income") : [],
								transactions.length > 1 ? GetMonthOfYearAmount(transactions, "Expense") : [],
							]}
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
