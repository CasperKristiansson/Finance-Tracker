

import axios from "axios";
import React from "react";
import { useEffect, useState } from "react";
import { DataPoint, LinearRegression } from "../../Utils/LinearRegression";
import { ConvertLoans, ConvertTransactions, Loan, Transaction } from "../../Utils/Transactions";
import { BalanceOverview } from "./ChildComponents/BalanceOverview";
import { GraphOverview } from "./ChildComponents/GraphOverview";
import { HeatMapOverview } from "./ChildComponents/HeatMapOverview";
import { IncomeExpenseOverview } from "./ChildComponents/IncomeExpenseOverview";
import { TableOverview } from "./ChildComponents/TableOverview";
import { Predictions } from "./ChildComponents/Predictions";

export const TotalReport: React.FC<{ userID: string, setApiLoading: any }> = ({ userID, setApiLoading }): JSX.Element => {
	const [transactions, setTransactions] = useState([] as Transaction[]);
	const [loans, setLoans] = useState([] as Loan[]);

	useEffect(() => {
		setApiLoading(true);
		var params = new URLSearchParams();
		params.append('userID', userID);

		axios.post('https://pktraffic.com/api/transactionsTotal.php', params).then(response => {
			setTransactions(ConvertTransactions(response.data.transactions));
			setApiLoading(false);
		}).catch(response => {
			console.log(response);
			setApiLoading(false);
		});

		axios.post('https://pktraffic.com/api/loans.php', params).then(response => {
			setLoans(ConvertLoans(response.data.transactions));
			setApiLoading(false);
		}).catch(response => {
			console.log(response);
			setApiLoading(false);
		});
	}, [userID]);

	return(
		<>
		<h1>TotalReport</h1>
		<BalanceOverview transactions={transactions} loans={loans} />
		<GraphOverview transactions={transactions} loans={loans} />
		<Predictions transactions={transactions} loans={loans} />
		<IncomeExpenseOverview transactions={transactions} loans={loans} />
		<HeatMapOverview transactions={transactions} />
		<TableOverview transactions={transactions} />
		</>
	);
}