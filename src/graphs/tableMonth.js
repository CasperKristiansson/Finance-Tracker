import React from "react";

export default (props) => {
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
        {
          Object.entries(props.data).map(([key, value]) => {
            return (
              <tr className={`${props.type} ${key == "Total" ? "netTotal" : ""}`}>
                <td className="netTitle">{key}</td>
                <td>{value[0].toFixed(1)}</td>
                <td>{value[1].toFixed(1)}</td>
                <td>{value[2].toFixed(1)}</td>
                <td>{value[3].toFixed(1)}</td>
                <td>{value[4].toFixed(1)}</td>
                <td>{value[5].toFixed(1)}</td>
                <td>{value[6].toFixed(1)}</td>
                <td>{value[7].toFixed(1)}</td>
                <td>{value[8].toFixed(1)}</td>
                <td>{value[9].toFixed(1)}</td>
                <td>{value[10].toFixed(1)}</td>
                <td>{value[11].toFixed(1)}</td>
                <td>{value[12].toFixed(1)}</td>
                <td>{value[13].toFixed(1)}</td>
              </tr>
            );
          })
        }        
			</tbody>
		</table>
	);
}
