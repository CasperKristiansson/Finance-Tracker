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
						<tr className={row.Type == "Income" ? "positive" : "negative"}>
							<td>
								<a href={`/editTransaction/${row.id_incr}`}>
									<i className="edit icon" />
								</a>
							</td>
							<td>{stringifyTime(row.Date)}</td>
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
	);
}

function stringifyTime(date) {
  let dateArray = date.split(" ");
  return dateArray[0];
}
