import axios from "axios";
import { useEffect, useState } from "react";
import { ConvertLoans, ConvertTransactions, Loan, Transaction } from "../../Utils/Transactions";
import { BalanceOverview } from "./ChildComponents/BalanceOverview";
import { Header } from "./ChildComponents/Header";

export const YearlyReport: React.FC<{ userID: string }> = ({ userID }): JSX.Element => {
	const [transactions, setTransactions] = useState([] as Transaction[]);
	const [year, setYear] = useState(new Date().getFullYear());

	useEffect(() => {
		var params = new URLSearchParams();
		params.append('year', year.toString());
		params.append('userID', userID);
		  
		axios.post('https://pktraffic.com/api/transactions.php', params).then(response => {
			console.log(response.data);
			setTransactions(response.data.transactions);
		}).catch(response => {
			console.log(response);
		});		
	}, [year, userID]);

	return(
		<>
		<Header handleYearChange={(e: any) => setYear(e.target.value)} />
		<BalanceOverview transactions={transactions} />
		</>
	);
}