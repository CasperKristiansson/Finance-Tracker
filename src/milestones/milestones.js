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
	const [milestones, setMilestones] = useState({});
	var loadedTransactions = false;

	let navigate = useNavigate();

	useEffect(() => {
		if (!loadedTransactions) {
			axios.get('https://pktraffic.com/api/transactionsTotal.php').then(response => {
				console.log(response.data);
				setMilestones(calculateMilestones(response.data.transactions));
			}).catch(response => {
				console.log(response);
			});

			loadedTransactions = true;
		}
	}, []);
	
	return(
		<>
		<div className={"main-section"}>
			<div className={"main-section-content"}>
				<h1>MileStones</h1>
				{/* Create  Milestones. Meaning create a table like view. Show the milestone amount and when it was achived. */}
				
			</div>
		</div>
		</>
	);
};

function calculateMilestones(transactions) {
	var milestones = {
		20000: {
			achieved: false,
			achievedDate: null,
			achievedTime: null
		},
		50000: {
			achieved: false,
			achievedDate: null,
			achievedTime: null
		},
		100000: {
			achieved: false,
			achievedDate: null,
			achievedTime: null
		},
		250000: {
			achieved: false,
			achievedDate: null,
			achievedTime: null
		},
		500000: {
			achieved: false,
			achievedDate: null,
			achievedTime: null
		},
		750000: {
			achieved: false,
			achievedDate: null,
			achievedTime: null
		},
		1000000: {
			achieved: false,
			achievedDate: null,
			achievedTime: null
		},
		1500000: {
			achieved: false,
			achievedDate: null,
			achievedTime: null
		},
		2000000: {
			achieved: false,
			achievedDate: null,
			achievedTime: null
		}
	}

	// sort the transactions
	transactions.sort(function(a, b) {
		return new Date(a.Date) - new Date(b.Date);
	});

	var total = 0;
	var date = transactions[0].Date;
	for (var i = 0; i < transactions.length; i++) {
		if (transactions[i].Type == "Income") {
			total += parseInt(transactions[i].Amount);
		} else if (transactions[i].Type == "Expense") {
			total -= parseInt(transactions[i].Amount);
		} else {
			continue;
		}
		
		for (var milestone in milestones) {
			if (milestones[milestone].achieved === false && total >= milestone) {
				milestones[milestone].achieved = true;
				milestones[milestone].achievedDate = transactions[i].Date;
				milestones[milestone].achievedTime = calculateTime(date, transactions[i].Date);
			}
		}
	}

	console.log(milestones);

	return milestones;
}

function calculateTime(date1, date2) {
	var date1 = new Date(date1);
	var date2 = new Date(date2);

	var timeDiff = Math.abs(date2.getTime() - date1.getTime());
	var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));

	return diffDays;
}
