import React from "react";
import { Grid, Segment, Button } from "semantic-ui-react";
import "./header.css"

export default (props) => {
	return(
		<div className={"home-header"}>
			<div className={"date-picker"}>
				<select className="ui dropdown home-picker" onChange={(e) => props.handleYearChange(e)}>
					<option value="">Pick Year</option>
					{Array.from(Array(new Date().getFullYear() - 2018 + 1).keys()).map(i => {
						return <option value={2018 + i}>{2018 + i}</option>;
					})}
				</select>
				<div className={"button-group"}>
				
					<Button.Group>
						<Button onClick={() => props.handleMonthChange(props.currentMonth - 1)}>-</Button>
						<div className="or" data-text={props.currentMonth + 1}></div>
						<Button onClick={() => props.handleMonthChange(props.currentMonth + 1)}>+</Button>
					</Button.Group>

				</div>
			</div>
			<h1>Monthly Overview</h1>
		</div>
	);
}
