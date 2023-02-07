import React, {useEffect, useState} from "react";

import { HomeHeader } from './ChildComponents/HomeHeader';

import { getStartPeriod, MonthYear } from '../../Utils/Date';

export const Home: React.FC<{ userID: string }> = ({ userID }): JSX.Element => {
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

	return (
		<>
			<HomeHeader
				handleYearChange={(e: { target: { value: string; }; }) => {
					console.log(e.target.value)
					setPeriod({ ...period, year: parseInt(e.target.value) });
				}}
				currentMonth={period.month}
				handleMonthChange={(month: number) => {
					if (month < 0) {
						setPeriod({ ...period, month: 11, year: period.year - 1 });
					} else if (month > 11) {
						setPeriod({ ...period, month: 0, year: period.year + 1 });
					} else {
						setPeriod({ ...period, month: month });
					}
				}}
			/>
		</>
	);
}
