import React from "react";
import { createUseStyles } from "react-jss";
import { Grid, Segment, Button } from "semantic-ui-react";
import { GetMonthOfYearAmount, Transaction } from "../../../Utils/Transactions";

const useStyles = createUseStyles({
});

export const Banner: React.FC<{ transactions: Transaction[], month: number }> = ({ transactions, month }): JSX.Element => {
	const classes = useStyles();

	const [income, setIncome] = React.useState([] as number[]);
	const [expenses, setExpenses] = React.useState([] as number[]);

	React.useEffect(() => {
		setIncome(GetMonthOfYearAmount(transactions, "Income"));
		setExpenses(GetMonthOfYearAmount(transactions, "Expense"));
	}, [transactions]);
		

  return (
		<>
			<Segment style={{height: "200px"}}>
				<div className="waveWrapper waveAnimation">
					<div className="waveWrapperInner bgTop">
						<div className="wave waveTop" style={{backgroundImage: "url('http://front-end-noobs.com/jecko/img/wave-top.png')"}}></div>
					</div>
					<div className="waveWrapperInner bgMiddle">
						<div className="wave waveMiddle" style={{backgroundImage: "url('http://front-end-noobs.com/jecko/img/wave-mid.png')"}}></div>
					</div>
					<div className="waveWrapperInner bgBottom">
						<div className="wave waveBottom" style={{backgroundImage: "url('http://front-end-noobs.com/jecko/img/wave-bot.png')"}}></div>
					</div>
				</div>
				<div className="home-income-label">
					<h2>This Month</h2>
				</div>
				<div className="ui statistic home-income-label-left green">
					<div className="value">
						{income[month] ? (income[month]).toFixed(1) : 0} kr
					</div>
					<div className="label" style={{color: "#21BA45"}}>
						Income
					</div>
				</div>
				<div className="ui statistic home-income-label-right red">
					<div className="value">
						{expenses[month] ? (expenses[month]).toFixed(1) : 0} kr
					</div>
					<div className="label" style={{color: "#DB2828"}}>
						Expenses
					</div>
				</div>
			</Segment>
		</>
	);
}