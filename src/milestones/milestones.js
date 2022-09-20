import React, {useEffect, useState} from "react";
import { Grid, Segment, Divider, Button, Icon, Header } from "semantic-ui-react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import './milestones.css';


export default (props) => {
	const [milestones, setMilestones] = useState([]);
	const [transactions, setTransactions] = useState([]);
	const [loans, setLoans] = useState([]);
	
	var loadedTransactions = false;

	let navigate = useNavigate();

	useEffect(() => {
		if (!loadedTransactions) {
			var params = new URLSearchParams();
			params.append('userID', props.userID);

			axios.post('https://pktraffic.com/api/transactionsTotal.php', params).then(response => {
				console.log(response.data);
				setTransactions(response.data.transactions);
			}).catch(response => {
				console.log(response);
			});

			axios.post('https://pktraffic.com/api/loans.php', params).then(response => {
				console.log(response.data);
				setLoans(response.data.transactions);
			}).catch(response => {
				console.log(response);
			});

			loadedTransactions = true;
		}
	}, []);

	useEffect(() => {
		if (transactions.length > 0 && loans.length > 0) {
			loans.forEach(loan => {
				transactions.push({
					"Type": "Expense",
					"Amount": loan.amount,
					"Date": loan.date,
				});
			});
			setMilestones(calculateMilestones(transactions));
		}
	}, [transactions, loans]);

	
	return(
		<>
		<div className={"main-section"}>
			<div className={"main-section-content"}>
				<h1>MileStones</h1>
				{/* Create  Milestones. Meaning create a table like view. Show the milestone amount and when it was achived. */}
				<Grid columns={2}>
					{milestones.map((milestone, index) => {
						// Display the milestone if it has been achieved, the date it was achieved, and the time it took to achieve it in days. Also display a title for the milestone.
						return (
							<Grid.Column key={index}>
								<div className={"milestone"}>
									<Segment color={milestone.achieved ? "green" : "red"}>
										<Header size="medium">{`Milestone ${parseInt(milestone.title).toLocaleString()}kr`}</Header>
										<Divider inverted />
										<h4>Date Achieved</h4>
										<p>{milestone.achievedDate !== null ? milestone.achievedDate : "Not Achieved"}</p>
										<h4>Days to Achieve</h4>
										<p>{milestone.achievedTime !== null ? `${milestone.achievedTime} days` : "Not Achieved"}</p>
									</Segment>
								</div>
							</Grid.Column>
						);
					})}
				</Grid>
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
		},
		3000000: {
			achieved: false,
			achievedDate: null,
			achievedTime: null
		},
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
				milestones[milestone].achievedDate = formatDate(transactions[i].Date);
				milestones[milestone].achievedTime = calculateTime(date, transactions[i].Date);

				var date = transactions[i].Date;
			}
		}
	}

	var milestonesArray = [];
	for (var milestone in milestones) {
		milestonesArray.push({
			title: milestone,
			achieved: milestones[milestone].achieved,
			achievedDate: milestones[milestone].achievedDate,
			achievedTime: milestones[milestone].achievedTime
		});
	}

	return milestonesArray;
}

function calculateTime(date1, date2) {
	var date1 = new Date(date1);
	var date2 = new Date(date2);

	var timeDiff = Math.abs(date2.getTime() - date1.getTime());
	var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));

	return diffDays;
}

function formatDate(date) {
	return date.split(" ")[0];
}
