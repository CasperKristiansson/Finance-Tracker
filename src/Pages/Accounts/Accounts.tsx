import React, {useEffect, useState} from "react";
import { createUseStyles } from "react-jss";
import axios from 'axios';
import { Button, Divider, Grid, Header, Icon, Segment } from "semantic-ui-react";
import { Account, ConvertTransactions, GetAccountsBalance, Transaction } from "../../Utils/Transactions";
import { useNavigate } from "react-router-dom";
import { FormatNumber } from "../../Utils/Miscellaneous";

const useStyles = createUseStyles({
	header: {
		fontSize: 35,
	},
});

export const Accounts: React.FC<{ userID: string, transactions: Transaction }> = ({ userID, transactions }): JSX.Element => {
	const classes = useStyles();
	const navigate = useNavigate();

	const [accounts, setAccounts] = useState([{Name: "Loading...", Balance: 0}] as Account[]);

	useEffect(() => {
		var params = new URLSearchParams();
		params.append('userID', userID);

		axios.post('https://pktraffic.com/api/transactionsTotal.php', params).then(response => {
			setAccounts(GetAccountsBalance(ConvertTransactions(response.data.transactions)))
		}).catch(response => {
			console.log(response);
		});
	}, [userID]);
	
	return (
		<>
		<h1 className={classes.header}>Accounts</h1>
		<Grid columns={4}>
			{accounts.map((account, index) => {
				return(
					<Grid.Column key={index}>
						<Segment className={`left aligned ui ${account.Balance >= 0 ? "green" : "red"} `}>
							<Button icon
								floated="right"
								size="mini"
								onClick={() => navigate(`/editAccount/?account=${account.Name}&balance=${account.Balance}`)}
							>
								<Icon name="edit" />
							</Button>
							<Header size="medium" floated="left">{account.Name}</Header>
							<br />
							<Divider inverted />
							<h4>Available Balance</h4>
							<h2>{FormatNumber(account.Balance, 1)}</h2>
						</Segment>
					</Grid.Column>
				);
			})}
		</Grid>
		</>
	);
};