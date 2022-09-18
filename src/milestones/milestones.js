import React, {useEffect, useState} from "react";
import { Grid, Segment, Divider, Button, Icon, Header } from "semantic-ui-react";
import BarChart from "../graphs/barchart";
import LineChart from "../graphs/linechart";
import PieChart from "../graphs/piechart";
import HeatMap from "../graphs/heatmap";
import Table from "../graphs/tableMonth.js";
import axios from "axios";
import { useNavigate } from "react-router-dom";


export default (props) => {
	
	return(
		<>
		<div className={"main-section"}>
			<div className={"main-section-content"}>
				<h1>MileStones</h1>
			</div>
		</div>
		</>
	);
};
