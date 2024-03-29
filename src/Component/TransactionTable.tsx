import React from "react";
import { createUseStyles } from "react-jss";
import { useNavigate } from "react-router-dom";
import { Icon } from "semantic-ui-react";
import { StringifyTimeShort } from "../Utils/Date";
import { GetTransactionColorType } from "../Utils/Miscellaneous";
import { Transaction } from "../Utils/Transactions";

const useStyles = createUseStyles({
	pointerOnHover: {
		cursor: "pointer",
		border: "none",
		backgroundColor: "transparent",
	},
});

export const TransactionTable: React.FC<{ transactions: Transaction[] }> = ({ transactions }): JSX.Element => {
	let navigate = useNavigate();
	const classes = useStyles();
	
	return (
		<>
			<table className="ui table">
				<thead>
					<tr>
						<th>Edit</th>
						<th>Date</th>
						<th>Category</th>
						<th>Amount</th>
						<th>Account</th>
						<th>Income/Expense</th>
						<th className="five wide">Note</th>
					</tr>
				</thead>
				<tbody>
					{transactions.map((row, index) => {
						return (
							<tr className={GetTransactionColorType(row.Type)} key={index}>
								<td>
									<button onClick={() => navigate(`/editTransaction/${row.ID}`)} className={classes.pointerOnHover}>
										<Icon name="edit" color={"grey"} />
									</button>
								</td>
								<td>{StringifyTimeShort(row.Date)}</td>
								<td>{row.Category}</td>
								<td>{row.Amount}</td>
								<td>{row.Account}</td>
								<td>{row.Type}</td>
								<td>{row.Note}</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</>
	);
};
