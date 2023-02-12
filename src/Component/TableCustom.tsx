import React from "react";
import { FormatNumber } from "../Utils/Miscellaneous";

export interface TableStruct {
  columns: string[];
  rows: {
    row: string;
    data: number[];
  }[]
}

export const TableCustom: React.FC<{ data: TableStruct, color: string, type: string }> = ({ data, color, type }): JSX.Element => {
	return (
		<table className={`ui ${color} celled selectable table`}>
      <thead>
        <tr>
          {data.columns.map((col, i) => (
            <th key={i}>{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row, i) => (
          <tr key={i} className={type}>
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
