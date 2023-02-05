import React from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "semantic-ui-react";

const Table = (props) => {
	let navigate = useNavigate();

	return (
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
				{props.data ? props.data.map((row, index) => {
					return (
						<tr className={getTransactionColor(row.Type)} key={`homeTable${index}`}>
							<td>
								<button onClick={() => navigate(`/editTransaction/${row.id_incr}`)} className="pointer-on-hover">
									<Icon name="edit" color={"grey"} />
								</button>
							</td>
							<td>{stringifyTime(row.Date)}</td>
							<td>{row.Category}</td>
							<td>{row.Amount}</td>
							<td>{row.Account}</td>
							<td>{row.Type}</td>
							<td>{row.Note}</td>
						</tr>
					);
				}) : null}
			</tbody>
		</table>
	);
}

function stringifyTime(date) {
  let dateArray = date.split(" ");
  return dateArray[0];
}

function getTransactionColor(transactionType) {
	switch(transactionType) {
		case "Income":
			return "positive"
		case "Expense":
			return "negative"
		default:
			return ""
	}
}

export default Table;