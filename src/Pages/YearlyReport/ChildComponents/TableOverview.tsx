import React, { useEffect } from "react";
import { Segment } from "semantic-ui-react";
import TableCustom from "../../../Component/TableCustom";
import { Transaction, GetTableYears, NetChange, GetTableMonths } from "../../../Utils/Transactions";

export const TableOverview: React.FC<{transactions: Transaction[]}> = ({ transactions }): JSX.Element => {
	useEffect(() => {
		if (transactions.length > 1) {
			GetTableYears(transactions, "Income");
		}
	}, [transactions]);

  return(
		<>
		<Segment>
			<h1>Net Change</h1>
			<TableCustom 
				data={transactions.length > 1 ? NetChange(transactions) : {columns: [], rows: []} }
				color={"black"}
				type={""}
			/>
		</Segment>
		<Segment>
			<h1>Income</h1>
			<TableCustom 
				data={transactions.length > 1 ? GetTableMonths(transactions, "Income") : {columns: [], rows: []} }
				color={"green"}
				type={"positive"}
			/>
		</Segment>
		<Segment>
			<h1>Expense</h1>
			<TableCustom 
				data={transactions.length > 1 ? GetTableMonths(transactions, "Expense") : {columns: [], rows: []} }
				color={"red"}
				type={"negative"}
			/>
		</Segment>
		</>
	);
}
