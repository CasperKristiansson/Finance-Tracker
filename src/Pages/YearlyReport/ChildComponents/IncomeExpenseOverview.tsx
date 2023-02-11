import { Grid, Segment } from "semantic-ui-react";
import PieChart from "../../../graphs/piechart";
import { FilterTransactionsType, GetCategoriesAmount, GetCategoriesAmountIncomeExpense, GetCategoriesLabels, GetCategoriesLabelsIncomeExpense, Transaction } from "../../../Utils/Transactions";


export const IncomeExpenseOverview: React.FC<{transactions: Transaction[] }> = ({ transactions }): JSX.Element => {
	return(
		<>
		<Grid columns={3}>
			<Grid.Row stretched>
				<Grid.Column>
					<Segment>
						<PieChart
							title={`Income`}
							labels={GetCategoriesLabels(FilterTransactionsType(transactions, "Income"))}
							data={GetCategoriesAmount(FilterTransactionsType(transactions, "Income"))}
						/>
					</Segment>
				</Grid.Column>
				<Grid.Column>
					<Segment>
						<PieChart
							title={`Income / Expense`}
							labels={GetCategoriesLabelsIncomeExpense(transactions)}
							data={GetCategoriesAmountIncomeExpense(transactions)}
						/>
					</Segment>
				</Grid.Column>
				<Grid.Column>
					<Segment>
						<PieChart
							title={`Expense`}
							labels={GetCategoriesLabels(FilterTransactionsType(transactions, "Expense"))}
							data={GetCategoriesAmount(FilterTransactionsType(transactions, "Expense"))}
						/>
					</Segment>
				</Grid.Column>
			</Grid.Row>
		</Grid>
		</>
	);
}