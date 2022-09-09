import React from "react";

export default (props) => {
	return (
		<table className="ui table">
			<thead>
				<tr>
					<th>Jan</th>
					<th>Feb</th>
					<th>Mar</th>
					<th>Apr</th>
          <th>May</th>
					<th>Jun</th>
					<th>Jul</th>
					<th>Aug</th>
          <th>Sep</th>
          <th>Oct</th>
          <th>Nov</th>
          <th>Dec</th>
          <th>Total</th>
          <th>Average</th>
				</tr>
			</thead>
			<tbody>
				{props.data.map((row) => {
					return (
						<tr className={''}>
							<td>{row.Jan}</td>
              <td>{row.Feb}</td>
              <td>{row.Mar}</td>
              <td>{row.Apr}</td>
              <td>{row.May}</td>
              <td>{row.Jun}</td>
              <td>{row.Jul}</td>
              <td>{row.Aug}</td>
              <td>{row.Sep}</td>
              <td>{row.Oct}</td>
              <td>{row.Nov}</td>
              <td>{row.Dec}</td>
              <td>{row.Total}</td>
              <td>{row.Average}</td>
						</tr>
					);
				})}
			</tbody>
		</table>
	);
}
