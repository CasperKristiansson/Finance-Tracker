import React from "react";

const TableMonth = (props) => {
	return (
		<table className={`ui ${props.color} celled selectable table`}>
			<thead>
				<tr>
          <th>Type</th>
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
          <th>Tot</th>
          <th>Avg</th>
				</tr>
			</thead>
			<tbody>
        {props.data.map((item, index) => {
            return (
              <tr key={index}>
                <td>{item.row}</td>
                {item.data.map((data, index) => {
                    return (
                      <td key={index}>{data}</td>
                    );
                  })}
              </tr>
            );
        })}       
			</tbody>
		</table>
	);
}

export default TableMonth;
