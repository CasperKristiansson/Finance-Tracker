import React from "react";
import { useNavigate } from "react-router-dom";
import { Grid, Segment } from "semantic-ui-react";
import { LineChart, LineChartColorS, LineChartStruct } from "../../../Component/LineChart";
import { LoansLineChart, NetWorthLineChart } from "../../../Utils/Data/Linechart";
import { ConvertLoansToTransactions, GetLineChartValues, Loan, Transaction } from "../../../Utils/Transactions";

export const GraphOverview: React.FC<{transactions: Transaction[], loans: Loan[]}> = ({ transactions, loans }): JSX.Element => {
	const navigate = useNavigate();

	return(
		<>
		<Grid columns={2}>
			<Grid.Row stretched>
				<Grid.Column>
					<Segment>
						<LineChart
							title={`Assets`}
							data={transactions.length ? GetLineChartValues(transactions, "Assets") : {labels: ["Loading..."], data: [0], color: new LineChartColorS()} as LineChartStruct}
							height={undefined}
							customClickEvent={(_event: any, element: any) => {
								const date: string = GetLineChartValues(transactions, "Assets").labels[element[0].index];
								navigate(`/?year=${date.split("-")[0]}&month=${parseInt(date.split("-")[1]) - 1}&type=Income`);
							}}
						/>
					</Segment>
				</Grid.Column>
				<Grid.Column>
					<Segment>
						<LineChart
							title={`Loans`}
							data={loans.length ? GetLineChartValues(loans, "Loans", LoansLineChart) : {labels: ["Loading..."], data: [0], color: new LineChartColorS()} as LineChartStruct}
							height={undefined}
							customClickEvent={(_event: any, element: any) => {
								const date: string = GetLineChartValues(transactions, "Loans").labels[element[0].index];
								navigate(`/?year=${date.split("-")[0]}&month=${parseInt(date.split("-")[1]) - 1}&type=Income`);
							}}
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
						data={loans.length && transactions.length ? GetLineChartValues([...transactions, ...ConvertLoansToTransactions(loans)], "Net Worth", NetWorthLineChart) : {labels: ["Loading..."], data: [0], color: new LineChartColorS()} as LineChartStruct}
						height={80}
						customClickEvent={(_event: any, element: any) => {
							const date: string = GetLineChartValues([...transactions, ...ConvertLoansToTransactions(loans)], "Net Worth", NetWorthLineChart).labels[element[0].index];
							navigate(`/?year=${date.split("-")[0]}&month=${parseInt(date.split("-")[1]) - 1}&type=Income`);
						}}
					/>
				</Segment>
			</Grid.Column>
		</Grid>
		</>
	);
}
