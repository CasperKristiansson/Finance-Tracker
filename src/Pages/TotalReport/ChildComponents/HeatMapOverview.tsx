import React from "react";
import { Grid, Segment } from "semantic-ui-react";
import { GetHeatmap, Transaction } from "../../../Utils/Transactions";
import { Heatmap, HeatmapStruct } from "../../../Component/Heatmap";
import { HeatMapExpenseColors, HeatMapIncomeColors } from "../../../Utils/Data/HeatMap";

export const HeatMapOverview: React.FC<{transactions: Transaction[]}> = ({ transactions }): JSX.Element => {
  return(
		<>
		<Grid columns={2}>
			<Grid.Row stretched>
				<Grid.Column>
					<Segment>
						<Heatmap
							title={`Income`}
							data={transactions.length > 1 ? GetHeatmap(transactions, "Income") : [ {name: "loading...", data: [{}]} as HeatmapStruct ]}
							color={HeatMapIncomeColors}
						/>
					</Segment>
				</Grid.Column>
				<Grid.Column>
					<Segment>
						<Heatmap
							title={`Expense`}
							data={transactions.length > 1 ? GetHeatmap(transactions, "Expense") : [ {name: "loading...", data: [{}]} as HeatmapStruct ]}
							color={HeatMapExpenseColors}
						/>
					</Segment>
				</Grid.Column>
			</Grid.Row>
		</Grid>
		</>
	);
}
