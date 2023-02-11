import axios from "axios";
import { useEffect, useState } from "react";
import { createUseStyles } from "react-jss"
import { GetSuccessCode, GetTransactionColors, GetTransactionColorType } from "../../Utils/Miscellaneous";
import { ConvertTransactions, DropDown, GetAccountsMapping, GetCategoriesMapping, Transaction } from "../../Utils/Transactions";
import { Button, Form, Segment, Input, Radio, TextArea, Dropdown, Message } from 'semantic-ui-react'
import { StringifyTime, StringifyTimeShort } from "../../Utils/Date";


const useStyles = createUseStyles({
	wrapper: {
		width: "50%",
		margin: "auto",
	},
	datePicker: {
		width: 200.,
		margin: "auto",
	}
});

export const AddTransaction: React.FC<{ userID: string }> = ({ userID }): JSX.Element => {
	const classes = useStyles();

	const [transaction, setTransaction] = useState({Type: "Income", Date: new Date()} as Transaction);

	const [incomeCategories, setIncomeCategories] = useState([] as DropDown[]);
	const [expenseCategories, setExpenseCategories] = useState([] as DropDown[]);
	const [accounts, setAccounts] = useState([] as DropDown[]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [successSubmitting, setSuccessSubmitting] = useState(null as boolean | null);

	useEffect(() => {
		var params = new URLSearchParams();
		params.append('userID', userID);

		axios.post('https://pktraffic.com/api/transactionInformation.php', params).then(response => {
			setIncomeCategories(GetCategoriesMapping(response.data.categories, "Income"));
			setExpenseCategories(GetCategoriesMapping(response.data.categories, "Expense"));
			setAccounts(GetAccountsMapping(response.data.accounts));
		}).catch(response => {
			console.log(response);
		});
	}, [userID]);

	const handleSubmit = () => {
		setIsSubmitting(true);
		var params = new URLSearchParams();
		params.append('type', transaction.Type);
		params.append('amount', transaction.Amount.toString());
		params.append('date', StringifyTime(transaction.Date));
		params.append('category', transaction.Category);
		params.append('description', transaction.Note);
		params.append('account', transaction.Account);
		params.append('userID', userID);

		axios.post('https://pktraffic.com/api/addTransaction.php', params).then(response => {
			setIsSubmitting(false);
			setSuccessSubmitting(true);
			setTransaction({
				Type: "Income",
				Date: new Date(),
				Amount: NaN,
				Category: "",
				Note: "",
				Account: "",
			} as Transaction);
		}).catch(response => {
			console.log(response);
			setIsSubmitting(false);
		});
	}

	return (
		<>
		<h1>Add New Transaction</h1>
		<div className={classes.wrapper} >
		<Segment className={`ui ${GetTransactionColors(transaction.Type)}`}>
			<Form className={GetSuccessCode(successSubmitting, isSubmitting)}>
				<Form.Field>
					<label>Transaction Type</label>
				</Form.Field>
				<Form.Group widths='equal'>
					<Form.Field
						control={Radio}
						label='Income'
						name='radioGroup'
						value='Income'
						onChange={(_e: any, {value}: any) => setTransaction({...transaction, Type: value})}
						checked={transaction.Type === 'Income'}
					/>
					<Form.Field
						control={Radio}
						label='Expense'
						name='radioGroup'
						value='Expense'
						onChange={(_e: any, {value}: any) => setTransaction({...transaction, Type: value})}
						checked={transaction.Type === 'Expense'}
					/>
					<Form.Field
						control={Radio}
						label='Transfer'
						name='radioGroup'
						value='Transfer-Out'
						onChange={(_e: any, {value}: any) => setTransaction({...transaction, Type: value})}
						checked={transaction.Type === 'Transfer-Out'}
					/>
				</Form.Group>

				<Form.Field>
					<label>Date</label>
					<div  className={classes.datePicker}>
						<input
							type="date" 
							value={transaction.Date ? StringifyTimeShort(transaction.Date): new Date().toISOString().slice(0, 10)}
							onChange={(e) => {
								console.log(e.target.value)
								setTransaction({...transaction, Date: new Date(e.target.value)});
							}}
							name="date"
						/>
					</div>
				</Form.Field>
				<Form.Field>
					<label>{transaction.Type === "Transfer-Out" ? "From": "Account"}</label>
					<Dropdown
						options={accounts}
						placeholder={transaction.Type === "Transfer-Out" ? "Send From Account": "Choose Account"}
						search
						selection
						fluid
						allowAdditions
						value={transaction.Account}
						onChange={(e: any, {value}: any) => setTransaction({...transaction, Account: value})}
					/>
				</Form.Field>
				<Form.Field>
					<label>{transaction.Type === "Transfer-Out" ? "To" : "Category"}</label>
					<Dropdown
						options={transaction.Type === "Transfer-Out" ? accounts : transaction.Type === "Income" ? incomeCategories : expenseCategories}
						placeholder={transaction.Type === "Transfer-Out" ? "Send To Account": "Choose Category"}
						search
						selection
						fluid
						allowAdditions
						value={transaction.Category}
						onChange={(e: any, {value}: any) => setTransaction({...transaction, Category: value})}
					/>
				</Form.Field>
				<Form.Field>
					<label>Amount</label>
					<Input
						placeholder='Amount'
						type="number"
						value={transaction.Amount ? transaction.Amount : ""}
						onChange={(e: any, {value}: any) => setTransaction({...transaction, Amount: value})}
					/>
				</Form.Field>
				<Form.Field>
					<label>Note</label>
					<TextArea
						placeholder='Note'
						onChange={(e: any, {value}: any) => setTransaction({...transaction, Note: value})}
						value={transaction.Note} />
				</Form.Field>
			<Message
				success
				header='Form Completed'
				content="Transaction has been added"
			/>
			<Message
				error
				header='Form Error'
				content="Please fill out all fields"
			/>
			<Button type='submit' color={GetTransactionColors(transaction.Type)} onClick={handleSubmit}>Submit</Button>					
			</Form>
			</Segment>
		</div>
	</>
	);
}