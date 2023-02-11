import { Grid, Segment } from "semantic-ui-react";
import LineChart from "../../../graphs/linechart";
import { LoansLineChart, NetWorthLineChart } from "../../../Utils/Data/Linechart";
import { ConvertLoansToTransactions, GetLineChartValues, Loan, Transaction } from "../../../Utils/Transactions";

export const GraphOverview: React.FC<{transactions: Transaction[], loans: Loan[]}> = ({ transactions, loans }): JSX.Element => {
	return(
		<>
		<Grid columns={2}>
			<Grid.Row stretched>
				<Grid.Column>
					<Segment>
						<LineChart
							title={`Assets`}
							data={transactions.length ? GetLineChartValues(transactions) : [["Loading..."], [0]]}
						/>
					</Segment>
				</Grid.Column>
				<Grid.Column>
					<Segment>
						<LineChart
							title={`Loans`}
							data={loans.length ? GetLineChartValues(loans) : [["Loading..."], [0]]}
							colors={LoansLineChart}
						/>
					</Segment>
				</Grid.Column>
			</Grid.Row>
		</Grid>
		<Grid columns={1}>
			<Grid.Column>
				<Segment>
					<LineChart
						title={`Net Worth`}
						data={loans.length && transactions.length ? GetLineChartValues([...transactions, ...ConvertLoansToTransactions(loans)]) : [["Loading..."], [0]]}
						height={80}
						colors={NetWorthLineChart}
					/>
				</Segment>
			</Grid.Column>
		</Grid>
		</>
	);
}
