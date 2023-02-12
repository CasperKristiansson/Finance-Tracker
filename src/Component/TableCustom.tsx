import React from "react";
import { FormatNumber } from "../Utils/Miscellaneous";
import { createUseStyles } from 'react-jss';

const useStyles = createUseStyles({
  bold: {
    fontWeight: 'bold',
  }
});

export interface TableStruct {
  columns: string[];
  rows: {
    row: string;
    data: number[];
  }[]
}

export const TableCustom: React.FC<{ data: TableStruct, color: string, type: string }> = ({ data, color, type }): JSX.Element => {
	const classes = useStyles();
  
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
          <tr key={i} className={row.row === 'Total' || row.row === 'Average' ? `${classes.bold} ${type}` : type}>
            <td className={classes.bold}>{row.row}</td>
            {row.data.map((data, j) => (
              <td key={j} className={j >= row.data.length - 2 ? classes.bold : ""} >{FormatNumber(data, 1)}</td>
            ))}
          </tr>
        ))}
      </tbody>
		</table>
	);
}

export default TableCustom;
