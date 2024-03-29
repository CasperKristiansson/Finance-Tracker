import React, {useEffect, useState} from "react";
import { createUseStyles } from "react-jss";
import axios from 'axios';

import { Header } from './ChildComponents/Header';
import { Overview } from "./ChildComponents/Overview";
import { Banner } from "./ChildComponents/Banner";

import { GetStartPeriod, GetStartType, MonthsLong } from '../../Utils/Date';
import { ConvertTransactions, FilterTransactionsMonth, Transaction, TransactionsSort } from '../../Utils/Transactions';
import { TransactionTable } from "../../Component/TransactionTable";
import { ExcelUploadData } from "../../Utils/Excel";

const useStyles = createUseStyles({
	messageSticky: {
		position: "fixed",
		top: 25,
		right: 25,
		width: 500,
		zIndex: 999,
	},
});

interface Message {
	message: JSX.Element | null;
	show: boolean;
}

export const Home: React.FC<{ userID: string, setApiLoading: any }> = ({ userID, setApiLoading }): JSX.Element => {
	const classes = useStyles();

	const [period, setPeriod] = useState(GetStartPeriod());
	const [pieChartType, setPieChartType] = React.useState(GetStartType());
	const [transactions, setTransactions] = useState([] as Transaction[]);
	const [message, setMessage] = useState({message: null, show: false} as Message);
	const [didMount, setDidMount] = useState(false);

	useEffect(() => {
		setApiLoading(true);
    	var params = new URLSearchParams();
    	params.append('year', period.year.toString());
	  	params.append('userID', userID);
      
		axios.post('https://pktraffic.com/api/transactions.php', params).then(response => {
			setTransactions(ConvertTransactions(response.data.transactions));
			setApiLoading(false);
		}).catch(response => {
			console.log(response);
			setApiLoading(false);
		});
    
	}, [period.year, userID]);

	useEffect(() => {
		if (!didMount) {
			setDidMount(true);
    		return;
		}

		var params = new URLSearchParams();
		params.append("year", period.year.toString());
		params.append("month", period.month.toString());
		params.append("type", pieChartType)
		window.history.pushState({}, "", "?" + params.toString());
	}, [period, pieChartType]);

	const handleMonthChange = (month: number) => {
		if (month < 0) {
			setPeriod({ ...period, month: 11, year: period.year - 1 });
		} else if (month > 11) {
			setPeriod({ ...period, month: 0, year: period.year + 1 });
		} else {
			setPeriod({ ...period, month: month });
		}
	};

	const handleMessage = (uploadInformation: ExcelUploadData) => {
		setMessage({message: uploadInformation.messageElement, show: true});

		setTimeout(() => {
			setMessage({message: null, show: false});
			window.location.reload();
		}, 5000);
	};

	return (
		<>
		<div className={classes.messageSticky}>
			{message.show ? message.message : null}
		</div>
		<Header
			handleYearChange={(e: { target: { value: string; }; }) => {
				setPeriod({ year: parseInt(e.target.value), month: 0 });
			}}
			currentMonth={period.month}
			handleMonthChange={handleMonthChange}	
		/>
		<Overview
			userID={userID}
			transactions={transactions}
			period={period}
			handleMessage={handleMessage}
			pieChartType={pieChartType}
			setPieChartType={setPieChartType}
			setPeriod={setPeriod}
		/>
		<Banner
			transactions={transactions}
			month={period.month}
			title={`${MonthsLong[period.month]} ${period.year}`}
		/>
		<TransactionTable
			transactions={TransactionsSort(FilterTransactionsMonth(transactions, period.month)).reverse()}
		/>
		</>
	);
}
