import React from "react";
import { FormatNumber } from "../Utils/Miscellaneous";

const TableCustom = (props) => {
	return (
		<table className={`ui ${props.color} celled selectable table`}>
      <thead>
        <tr>
          {props.data.columns.map((col, i) => (
            <th key={i}>{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {props.data.rows.map((row, i) => (
          <tr key={i} className={props.type}>
            <td>{row.row}</td>
            {row.data.map((data, j) => (
              <td key={j}>{FormatNumber(data, 1)}</td>
            ))}
          </tr>
        ))}
      </tbody>
		</table>
	);
}

export default TableCustom;
