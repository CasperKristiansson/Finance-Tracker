import React from "react";
import { Grid, Segment } from "semantic-ui-react";
import PieChart from "../../../Component/PieChart";
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
							data={{
								labels: GetCategoriesLabels(FilterTransactionsType(transactions, "Income")),
								data: GetCategoriesAmount(FilterTransactionsType(transactions, "Income"))
							}}
						/>
					</Segment>
				</Grid.Column>
				<Grid.Column>
					<Segment>
						<PieChart
							title={`Income / Expense`}
							data={{
								labels: GetCategoriesLabelsIncomeExpense(transactions),
								data: GetCategoriesAmountIncomeExpense(transactions)
							}}
						/>
					</Segment>
				</Grid.Column>
				<Grid.Column>
					<Segment>
						<PieChart
							title={`Expense`}
							data={{
								labels: GetCategoriesLabels(FilterTransactionsType(transactions, "Expense")),
								data: GetCategoriesAmount(FilterTransactionsType(transactions, "Expense"))
							}}
						/>
					</Segment>
				</Grid.Column>
			</Grid.Row>
		</Grid>
		</>
	);
}