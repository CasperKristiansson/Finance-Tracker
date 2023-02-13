import React from "react";
import axios from "axios";
import { useEffect, useState } from "react";
import { Divider, Grid, Segment } from "semantic-ui-react";
import { LineChart, LineChartColor, LineChartColorS } from "../../Component/LineChart";
import { AccountGraph, ConvertTransactions, GetAccountsBalanceGraph } from "../../Utils/Transactions";

export const AccountsReport: React.FC<{ userID: string,setApiLoading: any }> = ({ userID, setApiLoading }): JSX.Element => {
	const[accounts, setAccounts] = useState([{Name: "Loading...", Balance: [0], Labels: [""]}] as AccountGraph[]);

	useEffect(() => {
		setApiLoading(true);
		var params = new URLSearchParams();
		params.append('userID', userID);

		axios.post('https://pktraffic.com/api/transactionsTotal.php', params).then(response => {
			setAccounts(GetAccountsBalanceGraph(ConvertTransactions(response.data.transactions)))
			setApiLoading(false);
		}).catch(response => {
			console.log(response);
			setApiLoading(false);
		});
	}, [userID]);

	return (
		<>
		<h1>Accounts</h1>
		<Grid columns={2}>
			{accounts.map((account, index) => {
				return(
					<Grid.Column key={index}>
						<Segment className={`left aligned ui ${account.Balance[account.Balance.length - 1] >= 0 ? "green" : "red"} `}>
							<h3>{account.Name}</h3>
							<Divider inverted />
							<h4>Available Balance</h4>
							<h2>{account.Balance[account.Balance.length - 1].toLocaleString()}</h2>
							<LineChart
								title={"Balance"}
								data={{
										labels: account.Labels,
										data: account.Balance,
										title: "Balance",
										color: new LineChartColorS(),
								}}
								height={undefined}
							/>
						</Segment>
					</Grid.Column>
				);
			})}
		</Grid>
    </>
	);
}