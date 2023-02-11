import axios from "axios";
import { useEffect, useState } from "react";
import { ConvertTransactions, Transaction } from "../../Utils/Transactions";
import { BalanceOverview } from "./ChildComponents/BalanceOverview";
import { GraphOverview } from "./ChildComponents/GraphOverview";
import { Header } from "./ChildComponents/Header";
import { IncomeExpenseOverview } from "./ChildComponents/IncomeExpenseOverview";
import { TableOverview } from "./ChildComponents/TableOverview";

export const YearlyReport: React.FC<{ userID: string }> = ({ userID }): JSX.Element => {
	const [transactions, setTransactions] = useState([] as Transaction[]);
	const [year, setYear] = useState(new Date().getFullYear());

	useEffect(() => {
		var params = new URLSearchParams();
		params.append('year', year.toString());
		params.append('userID', userID);
		  
		axios.post('https://pktraffic.com/api/transactions.php', params).then(response => {
			console.log(response.data);
			setTransactions(ConvertTransactions(response.data.transactions));
		}).catch(response => {
			console.log(response);
		});		
	}, [year, userID]);

	return(
		<>
		<Header handleYearChange={(e: any) => setYear(e.target.value)} />
		<BalanceOverview transactions={transactions} />
		<GraphOverview transactions={transactions} currentYear={year} />
		<IncomeExpenseOverview transactions={transactions} />
		<TableOverview transactions={transactions} />
		</>
	);
}