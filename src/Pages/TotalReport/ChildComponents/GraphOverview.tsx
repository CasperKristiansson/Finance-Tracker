import React from "react";
import { useNavigate } from "react-router-dom";
import { Grid, Segment } from "semantic-ui-react";
import { LineChart, LineChartColor, LineChartStruct } from "../../../Component/LineChart";
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
							data={transactions.length ? GetLineChartValues(transactions) : {labels: ["Loading..."], data: [0]} as LineChartStruct}
							height={undefined}
							color={{} as LineChartColor}
							customClickEvent={(_event: any, element: any) => {
								const date: string = GetLineChartValues(transactions).labels[element[0].index];
								navigate(`/?year=${date.split("-")[0]}&month=${parseInt(date.split("-")[1]) - 1}&type=Income`);
							}}
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
							customClickEvent={(_event: any, element: any) => {
								const date: string = GetLineChartValues(transactions).labels[element[0].index];
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
						data={loans.length && transactions.length ? GetLineChartValues([...transactions, ...ConvertLoansToTransactions(loans)]) : {labels: ["Loading..."], data: [0]} as LineChartStruct}
						height={80}
						color={NetWorthLineChart}
						customClickEvent={(_event: any, element: any) => {
							const date: string = GetLineChartValues(transactions).labels[element[0].index];
							navigate(`/?year=${date.split("-")[0]}&month=${parseInt(date.split("-")[1]) - 1}&type=Income`);
						}}
					/>
				</Segment>
			</Grid.Column>
		</Grid>
		</>
	);
}
