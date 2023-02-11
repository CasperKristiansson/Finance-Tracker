import React, { useEffect } from "react";
import { Segment } from "semantic-ui-react";
import TableMonth from "../../../graphs/tableMonth";
import { Transaction, GetTableYears } from "../../../Utils/Transactions";

export const TableOverview: React.FC<{transactions: Transaction[]}> = ({ transactions }): JSX.Element => {
	useEffect(() => {
		if (transactions.length > 1) {
			GetTableYears(transactions, "Income");
		}
	}, [transactions]);

  return(
		<>
		<Segment>
			<h1>Income</h1>
			<TableMonth 
				data={transactions.length > 1 ? GetTableYears(transactions, "Income") : [] }
				color={"green"}
				type={""}
			/>
		</Segment>
		<Segment>
			<h1>Expenses</h1>
			<TableMonth
				data={transactions.length > 1 ? GetTableYears(transactions, "Expense") : []}
				color={"red"}
				type={""}
			/>
		</Segment>
		{/* <Segment>
			<h1>Income Categories</h1>
			<TableCustom
				data={tableCategoriesIncome}
				color={"green"}
				type={""}
			/>
		</Segment>
		<Segment>
			<h1>Expense Categories</h1>
			<TableCustom
				data={tableCategoriesExpense}
				color={"red"}
				type={""}
			/>
		</Segment> */}
		</>
	);
}
