import React from "react";
import { Grid, Segment } from "semantic-ui-react";
import { GetHeatmap, Transaction } from "../../../Utils/Transactions";
import HeatMap from "../../../graphs/heatmap";
import { HeatMapExpenseColors, HeatMapIncomeColors } from "../../../Utils/Data/HeatMap";

export const HeatMapOverview: React.FC<{transactions: Transaction[]}> = ({ transactions }): JSX.Element => {
  return(
		<>
		<Grid columns={2}>
			<Grid.Row stretched>
				<Grid.Column>
					<Segment>
						<HeatMap
							title={`Income`}
							data={transactions.length > 1 ? GetHeatmap(transactions, "Income") : [ {name: "loading...", data: [0]} ]}
							color={HeatMapIncomeColors}
						/>
					</Segment>
				</Grid.Column>
				<Grid.Column>
					<Segment>
						<HeatMap
							title={`Expense`}
							data={transactions.length > 1 ? GetHeatmap(transactions, "Expense") : [ {name: "loading...", data: [0]} ]}
							color={HeatMapExpenseColors}
						/>
					</Segment>
				</Grid.Column>
			</Grid.Row>
		</Grid>
		</>
	);
}
