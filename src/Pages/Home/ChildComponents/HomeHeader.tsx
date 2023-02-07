import { createUseStyles } from "react-jss"
import { Button } from "semantic-ui-react";

const useStyles = createUseStyles({
	datePicker: {
		position: "absolute",
		right: 0,
		display: "grid",
		gridTemplateColumns: "1fr 1fr",
		columnGap: 15,
		bottom: 15,
	},
	headerWrapper: {
		paddingBottom: 10,
		position: "relative",
	},
	picker: {
		borderRadius: 5,
		backgroundColor: "#E0E1E2",
		color: "#5A5A5A",
		borderColor: "#E0E1E2",
		border: "none !important",
		height: "36px !important",
	},
	header: {
		fontSize: 35,
	},
});

export const HomeHeader: React.FC<{ handleYearChange: any, currentMonth: number, handleMonthChange: any }> = ({ handleYearChange, currentMonth, handleMonthChange }): JSX.Element => {

	const classes = useStyles();

	return (
		<div className={classes.headerWrapper}>
			<div className={classes.datePicker}>
			<select className={`ui dropdown ${classes.picker}`} onChange={(e) => handleYearChange(e)}>
					<option value="">Pick Year</option>
					{Array.from(Array(new Date().getFullYear() - 2018 + 1).keys()).map(i => {
						return <option value={2018 + i} key={i} >{2018 + i}</option>;
					})}
				</select>
				<div className={"button-group"}>
					<Button.Group>
						<Button onClick={() => handleMonthChange(currentMonth - 1)}>-</Button>
						<div className="or" data-text={currentMonth + 1}></div>
						<Button onClick={() => handleMonthChange(currentMonth + 1)}>+</Button>
					</Button.Group>

				</div>
			</div>
			<h1 className={classes.header}>Monthly Overview</h1>
		</div>
	);
}