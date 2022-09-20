import React, { useEffect } from "react";

export default (props) => {
	return (
		<table className={`ui ${props.color} celled selectable table`}>
			<thead>
				<tr>
          <th>Type</th>
          {props.data.Total ? Object.keys(props.data.Total).map((key, index) => (
            <th key={index}>{key}</th>
          )) : null}
				</tr>
			</thead>
			<tbody>
        {
          Object.entries(props.data).map(([key, value]) => {
            return (
              <tr className={`${props.type} ${["Total", "Average"].includes(key) ? "netTotal" : ""}`}>
                <td className="netTitle">{key}</td>
                {Object.values(value).map((val, index) => (
                  <td key={index}>{val}</td>
                ))}
              </tr>
            );
          })
        }        
			</tbody>
		</table>
	);
}
