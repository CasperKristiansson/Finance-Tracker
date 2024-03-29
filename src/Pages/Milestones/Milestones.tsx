import axios from "axios";
import React, { useEffect, useState } from "react";
import { Divider, Grid, Header, Segment } from "semantic-ui-react";
import { Milestone } from "../../Utils/Data/Milestones";
import { StringifyTimeShort } from "../../Utils/Date";
import { FormatNumber } from "../../Utils/Miscellaneous";
import { ConvertLoans, ConvertLoansToTransactions, ConvertTransactions, GetMilestones, Loan, Transaction } from "../../Utils/Transactions";


export const Milestones: React.FC<{ userID: string, setApiLoading: any }> = ({ userID, setApiLoading }): JSX.Element => {
	const [transactions, setTransactions] = useState([] as Transaction[]);
	const [loans, setLoans] = useState([] as Loan[]);
	const [milestones, setMilestones] = useState([] as Milestone[]);

	useEffect(() => {
		setApiLoading(true);
		var params = new URLSearchParams();
		params.append('userID', userID);

		axios.post('https://pktraffic.com/api/transactionsTotal.php', params).then(response => {
			setTransactions(ConvertTransactions(response.data.transactions));
			setApiLoading(false);
		}).catch(response => {
			console.log(response);
			setApiLoading(false);
		});

		axios.post('https://pktraffic.com/api/loans.php', params).then(response => {
			setLoans(ConvertLoans(response.data.transactions));
			setApiLoading(false);
		}).catch(response => {
			console.log(response);
			setApiLoading(false);
		});
	}, [userID]);

	useEffect(() => {
		if (transactions.length > 0 && loans.length > 0) {
			const loanTransactions: Transaction[] = ConvertLoansToTransactions(loans);
			setMilestones(GetMilestones(transactions.concat(loanTransactions)))
		}
	}, [transactions, loans]);

  return(
		<>
		<h1>MileStones</h1>
		<Grid columns={2}>
			{milestones.map((milestone, index) => {
				return (
					<Grid.Column key={index}>
						<div className={"milestone"}>
							<Segment color={milestone.Achieved ? "green" : "red"}>
								<Header size="medium">{`Milestone ${FormatNumber(milestone.Amount)}kr`}</Header>
								<Divider inverted />
								<h4>Date Achieved</h4>
								<p>{milestone.AchievedDate !== null ? StringifyTimeShort(milestone.AchievedDate) : "Not Achieved"}</p>
								<h4>Days to Achieve</h4>
								<p>{milestone.TimeToAchieve !== null ? `${milestone.TimeToAchieve} days` : "Not Achieved"}</p>
							</Segment>
						</div>
					</Grid.Column>
				);
			})}
		</Grid>
		</>
	);
};