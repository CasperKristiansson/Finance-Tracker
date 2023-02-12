import React, { useEffect } from "react";
import { Segment } from "semantic-ui-react";
import TableCustom from "../../../Component/TableCustom";
import TableMonth from "../../../graphs/tableMonth";
import { Transaction, GetTableYears, GetTableCategories } from "../../../Utils/Transactions";

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
				type={"positive"}
			/>
		</Segment>
		<Segment>
			<h1>Expenses</h1>
			<TableMonth
				data={transactions.length > 1 ? GetTableYears(transactions, "Expense") : []}
				color={"red"}
				type={"negative"}
			/>
		</Segment>
		<Segment>
			<h1>Income Categories</h1>
			<TableCustom
				data={transactions.length > 1 ? GetTableCategories(transactions, "Income") : {columns: [], rows: []}}
				color={"green"}
				type={"positive"}
			/>
		</Segment>
		<Segment>
			<h1>Expense Categories</h1>
			<TableCustom
				data={transactions.length > 1 ? GetTableCategories(transactions, "Expense") : {columns: [], rows: []}}
				color={"red"}
				type={"negative"}
			/>
		</Segment>
		</>
	);
}
