import axios from "axios";
import { useEffect, useState } from "react";
import { createUseStyles } from "react-jss"
import { Divider, Grid, Segment } from "semantic-ui-react";
import LineChart from "../../graphs/linechart";
import { AccountGraph, ConvertTransactions, GetAccountsBalanceGraph } from "../../Utils/Transactions";

const useStyles = createUseStyles({

});

export const AccountsReport: React.FC<{ userID: string }> = ({ userID }): JSX.Element => {
	const classes = useStyles();

	const[accounts, setAccounts] = useState([{Name: "Loading...", Balance: [0], Labels: [""]}] as AccountGraph[]);

	useEffect(() => {
		var params = new URLSearchParams();
		params.append('userID', userID);

		axios.post('https://pktraffic.com/api/transactionsTotal.php', params).then(response => {
			setAccounts(GetAccountsBalanceGraph(ConvertTransactions(response.data.transactions)))
		}).catch(response => {
			console.log(response);
		});
	}, []);

	return (
		<>
		<h1>Accounts</h1>
		<Grid columns={2}>
			{accounts.map((account, index) => {
				return(
					<Grid.Column key={index}>
						<Segment className={`left aligned accountInformation ui ${account.Balance[account.Balance.length - 1] >= 0 ? "green" : "red"} `}>
							<h3>{account.Name}</h3>
							<Divider inverted />
							<h4>Available Balance</h4>
							<h2>{account.Balance[account.Balance.length - 1].toLocaleString()}</h2>
							<LineChart
								title={"Balance"}
								labels={account.Labels}
								data={account.Balance}
							/>
						</Segment>
					</Grid.Column>
				);
			})}
		</Grid>
    </>
	);
}