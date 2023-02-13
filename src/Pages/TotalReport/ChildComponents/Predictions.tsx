import React from "react";
import { useNavigate } from "react-router-dom";
import { Grid, Segment } from "semantic-ui-react";
import { LineChart, LineChartColor, LineChartColorS, LineChartStruct } from "../../../Component/LineChart";
import { GetLineChartValues, GetPredictionLineChart, Loan, Transaction } from "../../../Utils/Transactions";

export const Predictions: React.FC<{transactions: Transaction[], loans: Loan[]}> = ({ transactions, loans }): JSX.Element => {
	const navigate = useNavigate();

	return(
		<>
		<Grid columns={1}>
			<Grid.Column>
				<Segment>
                    <LineChart
                        title={`Predictions`}
                        data={transactions.length ? GetPredictionLineChart(transactions) : {labels: ["Loading..."], data: [0], color: new LineChartColorS()} as LineChartStruct}
                        height={80}
                        showRadius={true}
                    />
				</Segment>
			</Grid.Column>
		</Grid>
		</>
	);
}
