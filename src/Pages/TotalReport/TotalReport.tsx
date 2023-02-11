

import axios from "axios";
import { useEffect, useState } from "react";
import { ConvertLoans, ConvertTransactions, Loan, Transaction } from "../../Utils/Transactions";
import { BalanceOverview } from "./ChildComponents/BalanceOverview";
import { GraphOverview } from "./ChildComponents/GraphOverview";

export const TotalReport: React.FC<{ userID: string }> = ({ userID }): JSX.Element => {
	const [transactions, setTransactions] = useState([] as Transaction[]);
	const [loans, setLoans] = useState([] as Loan[]);

	useEffect(() => {
		var params = new URLSearchParams();
		params.append('userID', userID);

		axios.post('https://pktraffic.com/api/transactionsTotal.php', params).then(response => {
			setTransactions(ConvertTransactions(response.data.transactions));
		}).catch(response => {
			console.log(response);
		});

		axios.post('https://pktraffic.com/api/loans.php', params).then(response => {
			setLoans(ConvertLoans(response.data.transactions));
		}).catch(response => {
			console.log(response);
		});
	}, [userID]);

	return(
		<>
		<h1>TotalReport</h1>
		<BalanceOverview transactions={transactions} loans={loans} />
		<GraphOverview transactions={transactions} loans={loans} />
		</>
	);
}