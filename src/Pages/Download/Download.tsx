import React from "react";
import { createUseStyles } from "react-jss";
import axios from 'axios';
import { DownloadTransactions, DownloadTransactionTemplate } from "../../Utils/Excel";
import { Button, Divider, Grid, Header, Icon, Segment } from "semantic-ui-react";

const useStyles = createUseStyles({
	header: {
		fontSize: 35,
	},
});

export const Download: React.FC<{ userID: string }> = ({ userID }): JSX.Element => {
	const classes = useStyles();
	
	var handleTransactionTemplate = () => {
		DownloadTransactionTemplate();
	};

	var handleTransactionDownload = (type: string) => {
		var params: URLSearchParams = new URLSearchParams();
		params.append('userID', userID);
	
		if (type === "loan") {
			axios.post('https://pktraffic.com/api/loans.php', params).then(response => {
				DownloadTransactions(response.data.transactions, "Loans Export.xlsx");
			}).catch(response => {
				console.log(response);
			});
		} else if (type === "transaction") {
			axios.post('https://pktraffic.com/api/transactionsTotal.php', params).then(response => {
				DownloadTransactions(response.data.transactions, "Transactions Export.xlsx");
			}).catch(response => {
				console.log(response);
			});
		}
	};
	
	return (
		<>
		<h1 className={classes.header}>Download</h1>
		<Grid columns={3}>
			<Grid.Row>
				<Grid.Column>
					<Segment>
						<Header as="h2">Template Transaction</Header>
						<Divider />
						<Button color="blue" icon labelPosition="left" onClick={handleTransactionTemplate}>
							<Icon name="download" />
							Download
						</Button>
					</Segment>
				</Grid.Column>
				<Grid.Column>
					<Segment>
						<Header as="h2">All Transactions</Header>
						<Divider />
						<Button color="blue" icon labelPosition="left" onClick={() => handleTransactionDownload("transaction")}>
							<Icon name="download" />
							Download
						</Button>
					</Segment>
				</Grid.Column>
				<Grid.Column>
					<Segment>
						<Header as="h2">All Loans</Header>
						<Divider />
						<Button color="blue" icon labelPosition="left" onClick={() => handleTransactionDownload("loan")}>
							<Icon name="download" />
							Download
						</Button>
					</Segment>
				</Grid.Column>
			</Grid.Row>
		</Grid>
		</>
	);
};