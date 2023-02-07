import React from "react";
import { createUseStyles } from "react-jss";
import { Grid, Segment, Button } from "semantic-ui-react";
import { GetMonthOfYearAmount, Transaction } from "../../../Utils/Transactions";

const useStyles = createUseStyles({
  "@keyframes move_wave": {
		"0%": {
			transform: "translateX(0) translateZ(0) scaleY(1)"
		},
		"50%": {
			transform: "translateX(-25%) translateZ(0) scaleY(0.55)"
		},
		"100%": {
			transform: "translateX(-50%) translateZ(0) scaleY(1)"
		}
	},
	waveWrapper: {
		overflow: "hidden",
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		top: 0,
		margin: "auto"
	},
	waveWrapperInner: {
		position: "absolute",
		width: "100%",
		overflow: "hidden",
		height: "150px",
		bottom: "50px",
		backgroundImage: "linear-gradient(to bottom, #42896d, #3d926b, #3c9a67, #3da362, #42ab5a, #4bb459, #56be57, #61c754, #71d559, #81e35d, #91f162, #a2ff66)"
	},
	bgTop: {
		zIndex: 15,
		opacity: 0.5
	},
	bgMiddle: {
		zIndex: 10,
		opacity: 0.75
	},
	bgBottom: {
		zIndex: 5,
		opacity: 0.75
	},
	wave: {
		position: "absolute",
		left: 0,
		width: "200%",
		height: "100%",
		backgroundRepeat: "repeat no-repeat",
		backgroundPosition: "0 bottom",
		transformOrigin: "center bottom"
	},
	waveTop: {
		backgroundSize: "50% 100px",
	},
	waveAnimation: {
		waveTop: {
			animation: "$move-wave 3s",
			WebkitAnimation: "$move-wave 3s",
			WebkitAnimationDelay: "1s",
			animationDelay: "1s"
		},
	},
	waveMiddle: {
		backgroundSize: "50% 120px",
		animation: "$move_wave 10s linear infinite"
	},
	waveBottom: {
		backgroundSize: "50% 100px",
		animation: "$move_wave 15s linear infinite"
	},
	homeIncomeLabelLeft: {
		zIndex: 99999,
		position: "absolute",
		left: "25%",
		top: "45%"
	},
	homeIncomeLabelRight: {
		zIndex: 99999,
		position: "absolute",
		right: "25%",
		top: "53%"
	},
	homeIncomeLabel: {
		zIndex: 99999,
		position: "absolute",
		left: "50%",
		transform: "translate(-50%, -50%)",
		top: "15%",
		textAlign: "center",
		color: "white",
		"& h2": {
			fontSize: "50px",
		}
	},
	homeIncomeLabelH2: {
		fontSize: "50px",
		color: "white"
	},
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
				<div className={`${classes.waveWrapper} ${classes.waveAnimation}`}>
					<div className={`${classes.waveWrapperInner} ${classes.bgTop}`}>
						<div className={`${classes.wave} ${classes.waveTop}`} style={{backgroundImage: "url('http://front-end-noobs.com/jecko/img/wave-top.png')"}}></div>
					</div>
					<div className={`${classes.waveWrapperInner} ${classes.bgMiddle}`}>
						<div className={`${classes.wave} ${classes.waveMiddle}`} style={{backgroundImage: "url('http://front-end-noobs.com/jecko/img/wave-mid.png')"}}></div>
					</div>
					<div className={`${classes.waveWrapperInner} ${classes.bgBottom}`}>
						<div className={`${classes.wave} ${classes.waveBottom}`} style={{backgroundImage: "url('http://front-end-noobs.com/jecko/img/wave-bot.png')"}}></div>
					</div>
				</div>
				<div className={classes.homeIncomeLabel}>
					<h2>This Month</h2>
				</div>
				<div className={`${classes.homeIncomeLabelLeft} ui statistic green`}>
					<div className="value">
						{income[month] ? (income[month]).toFixed(1) : 0} kr
					</div>
					<div className="label" style={{color: "#21BA45"}}>
						Income
					</div>
				</div>
				<div className={`${classes.homeIncomeLabelRight} ui statistic red`}>
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