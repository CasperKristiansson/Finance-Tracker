import React from "react";
import { Grid, Segment } from "semantic-ui-react";
import { LineChart, LineChartColor, LineChartStruct } from "../../../Component/LineChart";
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
							data={transactions.length ? GetLineChartValues(transactions) : {labels: ["Loading..."], data: [0]} as LineChartStruct}
							height={undefined}
							color={{} as LineChartColor}
						/>
					</Segment>
				</Grid.Column>
				<Grid.Column>
					<Segment>
						<LineChart
							title={`Loans`}
							data={loans.length ? GetLineChartValues(loans) : {labels: ["Loading..."], data: [0]} as LineChartStruct}
							color={LoansLineChart}
							height={undefined}
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
						data={loans.length && transactions.length ? GetLineChartValues([...transactions, ...ConvertLoansToTransactions(loans)]) : {labels: ["Loading..."], data: [0]} as LineChartStruct}
						height={80}
						color={NetWorthLineChart}
					/>
				</Segment>
			</Grid.Column>
		</Grid>
		</>
	);
}
