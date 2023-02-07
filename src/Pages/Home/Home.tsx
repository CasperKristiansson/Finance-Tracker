import React, {useEffect, useState} from "react";
import { createUseStyles } from "react-jss";

import { Header } from './ChildComponents/Header';

import { getStartPeriod, MonthYear } from '../../Utils/Date';

const useStyles = createUseStyles({
	mainSection: {
		paddingTop: 1,
		marginLeft: 270,
		padding: "100px 25px",
	},
	mainSectionPie: {
		marginLeft: "25%",
		marginRight: "25%",
	},
	mainSectionButton: {
		width: "100%",
		height: 70,
	},
	gridMaxHeight: {
		height: "100%",
	},
	messageSticky: {
		position: "fixed",
		top: 25,
		right: 25,
		width: 500,
		zIndex: 999,
	},
});

export const Home: React.FC<{ userID: string }> = ({ userID }): JSX.Element => {
	const classes = useStyles();

	const [period, setPeriod] = useState(getStartPeriod());

	const [yearIncome, setYearIncome] = useState([]);
	const [yearExpense, setYearExpense] = useState([]);
	const [oldYear, setOldYear] = useState(null);
	const [transactions, setTransactions] = useState([]);
	const [categories, setCategories] = useState([]);
	const [categoriesAmount, setCategoriesAmount] = useState([]);
	const [pieChartType, setPieChartType] = useState("Income");
	const [showMessage, setShowMessage] = useState(false);
	const [message, setMessage] = useState("");

	useEffect(() => {
		var params = new URLSearchParams();
		params.append("year", period.year.toString());
		params.append("month", period.month.toString());
		window.history.pushState({}, "", "?" + params.toString());
	}, [period]);

	const handleMonthChange = (month: number) => {
		if (month < 0) {
			setPeriod({ ...period, month: 11, year: period.year - 1 });
		} else if (month > 11) {
			setPeriod({ ...period, month: 0, year: period.year + 1 });
		} else {
			setPeriod({ ...period, month: month });
		}
	};

	return (
		<>
		<div className={classes.messageSticky}>
			{showMessage ? message : null}
		</div>
		<div className={classes.mainSection}>
			<Header
				handleYearChange={(e: { target: { value: string; }; }) => {
					setPeriod({ year: parseInt(e.target.value), month: 0 });
				}}
				currentMonth={period.month}
				handleMonthChange={handleMonthChange}	
			/>
		</div>
		</>
	);
}
