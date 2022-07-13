import React from "react";


export default (props) => {
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
				{props.data.map((row) => {
					return (
						<tr className={row.type == "Income" ? "positive" : "negative"}>
							<td><i className="edit icon"></i></td>
							<td>{row.date}</td>
							<td>{row.category}</td>
							<td>{row.amount}</td>
							<td>{row.account}</td>
							<td>{row.type}</td>
							<td>{row.notes}</td>
						</tr>
					);
				})}
			</tbody>
		</table>
	);
}