import React, {useEffect, useState} from "react";
import { createUseStyles } from "react-jss";

import { HomeHeader } from './ChildComponents/HomeHeader';

import { getStartPeriod } from '../../Utils/Date';

// Convert to jss
// .main-section {
// 	padding-top: 0px;
// 	margin-left: 270px;
// 	padding: 25px 25px;
// }

// .main-section-pie {
// 	margin-left: 25%;
// 	margin-right: 25%;
// }

// .main-section-button {
// 	width: 100%;
// 	height: 70px;
// }

// .grid-max-height {
// 	height: 100%;
// }

// .message-sticky {
// 	position: fixed;
// 	top: 25px;
// 	right: 25px;
// 	width: 500px;
// 	z-index: 999;
// }
const useStyles = createUseStyles({
	mainSection: {
		paddingTop: 0,
		marginLeft: 270,
		padding: "25px 25px",
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

	return (
		<>
		<div className={classes.messageSticky}>
			{showMessage ? message : null}
		</div>
		<div className={classes.mainSection}>
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
		</div>
		</>
	);
}
