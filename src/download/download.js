import React, {useEffect, useState} from "react";
import { Grid, Segment, Divider, Button, Icon, Header } from "semantic-ui-react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import * as FileSaver from "file-saver";
import * as XLSX from "xlsx";


export default (props) => {
	var handleTransactionTemplate = () => {
		const jsonFormat = [
			{
				"Date": "",
				"Description": "",
				"Category": "",
				"Type": "",
				"Amount": "",
				"Account": "",
			}
		];

		const ws = XLSX.utils.json_to_sheet(jsonFormat);
		const wb = { Sheets: { data: ws }, SheetNames: ["data"] };
		const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
		const data = new Blob([excelBuffer], { type: 'xlsx' });
		
		var date = new Date();
		var fileName = "Transactions_" + date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + ".xlsx";
		FileSaver.saveAs(data, fileName);
	}

	return(
		<>
		<div className={"main-section"}>
			<div className={"main-section-content"}>
				<h1>Download</h1>
					<Grid columns={4}>
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
									<Button color="blue" icon labelPosition="left" onClick={() => window.open("http://localhost:3000/template/transactions")}>
										<Icon name="download" />
										Download
									</Button>
								</Segment>
							</Grid.Column>
						</Grid.Row>
					</Grid>
			</div>
		</div>
		</>
	);
};
