import axios from "axios";
import React from "react";
import { useEffect, useState } from "react";
import { GetStartYear } from "../../Utils/Date";
import { ConvertTransactions, Transaction } from "../../Utils/Transactions";
import { BalanceOverview } from "./ChildComponents/BalanceOverview";
import { GraphOverview } from "./ChildComponents/GraphOverview";
import { Header } from "./ChildComponents/Header";
import { IncomeExpenseOverview } from "./ChildComponents/IncomeExpenseOverview";
import { TableOverview } from "./ChildComponents/TableOverview";

export const YearlyReport: React.FC<{ userID: string, setApiLoading: any }> = ({ userID, setApiLoading }): JSX.Element => {
	const [transactions, setTransactions] = useState([] as Transaction[]);
	const [year, setYear] = useState(GetStartYear());
	const [didMount, setDidMount] = useState(false);

	useEffect(() => {
		setApiLoading(true);
		var params = new URLSearchParams();
		params.append('year', year.toString());
		params.append('userID', userID);
		  
		axios.post('https://pktraffic.com/api/transactions.php', params).then(response => {
			setTransactions(ConvertTransactions(response.data.transactions));
			setApiLoading(false);
		}).catch(response => {
			console.log(response);
			setApiLoading(false);
		});		
	}, [year, userID]);

	useEffect(() => {
		if (!didMount) {
			setDidMount(true);
    		return;
		}

		var params = new URLSearchParams();
		params.append("year", year.toString());
		window.history.pushState({}, "", "?" + params.toString());
	}, [year]);

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