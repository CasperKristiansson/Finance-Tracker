import { Grid, Segment } from "semantic-ui-react";
import { FormatNumber } from "../../../Utils/Miscellaneous";
import { TotalTransactionType, Transaction } from "../../../Utils/Transactions";

export const BalanceOverview: React.FC<{transactions: Transaction[] }> = ({ transactions }): JSX.Element => {
	return(
		<>
		<Grid columns={3}>
			<Grid.Row stretched>
				<Grid.Column>
					<Segment>
						<h3 className="ui green header">Expense</h3>
						<h1 className="ui green header">{FormatNumber(TotalTransactionType(transactions, "Expenses"))} kr</h1>
					</Segment>
				</Grid.Column>
				<Grid.Column>
					<Segment>
						<h3 className="ui red header">Income</h3>
						<h1 className="ui red header">{FormatNumber(TotalTransactionType(transactions, "Income"))} kr</h1>
					</Segment>
				</Grid.Column>
				<Grid.Column>
					<Segment>
						<h3 className="ui blue header">Total Assets</h3>
						<h1 className="ui blue header">{FormatNumber(TotalTransactionType(transactions, "Income") - TotalTransactionType(transactions, "Expenses"))} kr</h1>
					</Segment>
				</Grid.Column>
			</Grid.Row>
		</Grid>
		</>
	);
}