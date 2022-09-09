import React from "react";
import { Grid, Segment, Button } from "semantic-ui-react";
import "./header.css"

export default (props) => {
	return(
		<div className={"home-header"}>
			<div className={"dateYearly"}>
				<select className="ui dropdown yearlyReport-picker" onChange={(e) => props.handleYearChange(e)}>
					<option value="">Pick Year</option>
					{Array.from(Array(new Date().getFullYear() - 2018 + 1).keys()).map(i => {
						return <option value={2018 + i}>{2018 + i}</option>;
					})}
				</select>
			</div>
			<h1>Yearly Overview</h1>
		</div>
	);
}
