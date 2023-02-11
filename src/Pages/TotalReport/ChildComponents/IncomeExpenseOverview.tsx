import { Grid, Segment } from "semantic-ui-react";
import BarChart from "../../../graphs/barchart";
import { ExpenseIncomeBarChart, Loan, Transaction } from "../../../Utils/Transactions";


export const IncomeExpenseOverview: React.FC<{transactions: Transaction[], loans: Loan[]}> = ({ transactions, loans }): JSX.Element => {
	return(
		<>
		<Grid columns={1}>
			<Grid.Column>
				<Segment>
					<BarChart
						title={`Income vs Expenses`}
						data={ExpenseIncomeBarChart(transactions)}
						height={80}
					/>
				</Segment>
			</Grid.Column>
		</Grid>
		{/* <Grid columns={3}>
			<Grid.Row stretched>
				<Grid.Column>
					<Segment>
						<PieChart
							title={`Income`}
							labels={getCategories(transactions, "Income")}
							data={getTransactionAmounts(transactions, "Income")}
						/>
					</Segment>
				</Grid.Column>
				<Grid.Column>
					<Segment>
						<PieChart
							title={`Income / Expense`}
							labels={[`Income ${getPercent(transactions, "Income")}`,
								`Expense ${getPercent(transactions, "Expense")}`
							]}
							data={[
								getTotal(transactions, "Income"),
								getTotal(transactions, "Expense")
							]}
						/>
					</Segment>
				</Grid.Column>
				<Grid.Column>
					<Segment>
						<PieChart
							title={`Expense`}
							labels={getCategories(transactions, "Expense")}
							data={getTransactionAmounts(transactions, "Expense")}
						/>
					</Segment>
				</Grid.Column>
			</Grid.Row>
		</Grid> */}
		</>
	);
}