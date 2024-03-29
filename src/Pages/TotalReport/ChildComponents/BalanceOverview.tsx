import React from "react";
import { Grid, Segment } from "semantic-ui-react";
import { FormatNumber } from "../../../Utils/Miscellaneous";
import { Loan, TotalAssets, TotalLiabilities, TotalNetWorth, Transaction } from "../../../Utils/Transactions";

export const BalanceOverview: React.FC<{transactions: Transaction[], loans: Loan[]}> = ({ transactions, loans }): JSX.Element => {
	return(
		<>
		<Grid columns={3}>
			<Grid.Row stretched>
				<Grid.Column>
					<Segment>
						<h3 className="ui green header">Net Worth</h3>
						<h1 className="ui green header">{FormatNumber(TotalNetWorth(transactions, loans))} kr</h1>
					</Segment>
				</Grid.Column>
				<Grid.Column>
					<Segment>
						<h3 className="ui red header">Total Loans</h3>
						<h1 className="ui red header">{FormatNumber(TotalLiabilities(loans))} kr</h1>
					</Segment>
				</Grid.Column>
				<Grid.Column>
					<Segment>
						<h3 className="ui blue header">Total Assets</h3>
						<h1 className="ui blue header">{FormatNumber(TotalAssets(transactions))} kr</h1>
					</Segment>
				</Grid.Column>
			</Grid.Row>
		</Grid>
		</>
	);
}