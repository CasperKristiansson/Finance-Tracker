import React, {useEffect, useState} from "react";
import { Button, Form, Input, Radio, Segment, TextArea, Dropdown, Message } from 'semantic-ui-react'
import axios from 'axios';
import './transaction.css'

const AddTransaction = (props) => {
	const [transactionType, setTransactionType] = useState("Income");
	const [transactionAmount, setTransactionAmount] = useState("");
	const [transactionDate, setTransactionDate] = useState(getCurrentDate());
	const [transactionCategory, setTransactionCategory] = useState("");
	const [transactionDescription, setTransactionDescription] = useState("");
	const [transactionAccount, setTransactionAccount] = useState("");

	const [incomeCategories, setIncomeCategories] = useState([]);
	const [expenseCategories, setExpenseCategories] = useState([]);
	const [accounts, setAccounts] = useState([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [successSubmitting, setSuccessSubmitting] = useState(null);

	useEffect(() => {
		var params = new URLSearchParams();
		params.append('userID', props.userID);

		axios.post('https://pktraffic.com/api/transactionInformation.php', params).then(response => {
			setIncomeCategories(getCategories(response.data.categories, "Income"));
			setExpenseCategories(getCategories(response.data.categories, "Expense"));
			setAccounts(getAccounts(response.data.accounts));

			console.log(response.data)
		}).catch(response => {
			console.log(response);
		});
	}, [props.userID]);

	const handleChange = (e, { value }) => setTransactionType(value)

	const handleSubmit = () => {
		setIsSubmitting(true);
		var params = new URLSearchParams();
		params.append('type', transactionType);
		params.append('amount', transactionAmount);
		params.append('date', transactionDate);
		params.append('category', transactionCategory);
		params.append('description', transactionDescription);
		params.append('account', transactionAccount);
		params.append('userID', props.userID);

		axios.post('https://pktraffic.com/api/addTransaction.php', params).then(response => {
			setIsSubmitting(false);
			setSuccessSubmitting(response.data.success);
			console.log(response);

			clearFields();
		}).catch(response => {
			console.log(response);
			setIsSubmitting(false);
		});
	}

	const clearFields = () => {
		setTransactionType("Income");
		setTransactionAmount("");
		setTransactionCategory("");
		setTransactionDescription("");
		setTransactionAccount("");
	}

	const handleTransactionAccountChange = (value) => {
		if(accounts.filter(account => account.value === value).length === 0) {
			setAccounts([...accounts, {key: value, text: value, value: value}]);
		}

		setTransactionAccount(value);
	}

	const handleTransactionCategoryChange = (value) => {
		if(transactionType === "Income") {
			if(incomeCategories.filter(category => category.value === value).length === 0) {
				setIncomeCategories([...incomeCategories, {key: value, text: value, value: value}]);
			}
		} else {
			if(expenseCategories.filter(category => category.value === value).length === 0) {
				setExpenseCategories([...expenseCategories, {key: value, text: value, value: value}]);
			}
		}

		setTransactionCategory(value);
	}

	return (
		<div className={"main-section"}>
			<div className={"main-section-content"}>
				<h1>Add New Transaction</h1>
				<div className="transaction-form">
				<Segment className={`ui ${getColor(transactionType)}`}>
					<Form className={getSuccessCode(successSubmitting, isSubmitting)}>
						<Form.Field>
							<label>Transaction Type</label>
						</Form.Field>
						<Form.Group widths='equal'>
							<Form.Field
								control={Radio}
								label='Income'
								name='radioGroup'
								value='Income'
								onChange={handleChange}
								checked={transactionType === 'Income'}
							/>
							<Form.Field
								control={Radio}
								label='Expense'
								name='radioGroup'
								value='Expense'
								onChange={handleChange}
								checked={transactionType === 'Expense'}
							/>
							<Form.Field
								control={Radio}
								label='Transfer'
								name='radioGroup'
								value='Transfer-Out'
								onChange={handleChange}
								checked={transactionType === 'Transfer-Out'}
							/>
						</Form.Group>

						<Form.Field>
							<label>Date</label>
							<div  className="date-picker-form">
								<input
									type="date" 
									value={transactionDate}
									onChange={(e) => setTransactionDate(e.target.value)}
									name="date"
								/>
							</div>
						</Form.Field>

						{transactionType === "Transfer-Out" ? (
							<>
								<Form.Field>
									<label>From</label>
									<Dropdown
										options={accounts}
										placeholder='Send From Account'
										search
										selection
										fluid
										allowAdditions
										value={transactionAccount}
										onChange={(e, {value}) => handleTransactionAccountChange(value)}
									/>
								</Form.Field>
								<Form.Field>
									<label>To</label>
									<Dropdown
										options={accounts}
										placeholder='Send To Account'
										search
										selection
										fluid
										allowAdditions
										value={transactionCategory}
										onChange={(e, {value}) => handleTransactionCategoryChange(value)}
									/>
								</Form.Field>
								<Form.Field>
									<label>Amount</label>
									<Input placeholder='Amount' type="number" value={transactionAmount} onChange={(e, {value}) => setTransactionAmount(value)}/>
								</Form.Field>
								<Form.Field>
									<label>Note</label>
									<TextArea placeholder='Note' onChange={(e, {value}) => setTransactionDescription(value)} value={transactionDescription} />
								</Form.Field>
							</>
						) : (
							<>
							<Form.Field>
								<label>Account</label>
								<Dropdown
									options={accounts}
									placeholder='Choose Account'
									search
									selection
									fluid
									allowAdditions
									value={transactionAccount}
									onChange={(e, {value}) => handleTransactionAccountChange(value)}
								/>
							</Form.Field>
							<Form.Field>
								<label>Category</label>
								<Dropdown
									options={transactionType === "Income" ? incomeCategories : expenseCategories}
									placeholder='Choose Category'
									search
									selection
									fluid
									allowAdditions
									value={transactionCategory}
									onChange={(e, {value}) => handleTransactionCategoryChange(value)}
								/>
							</Form.Field>
							<Form.Field>
								<label>Amount</label>
								<Input placeholder='Amount' type="number" value={transactionAmount} onChange={(e, {value}) => setTransactionAmount(value)}/>
							</Form.Field>
							<Form.Field>
								<label>Note</label>
								<TextArea placeholder='Note' onChange={(e, {value}) => setTransactionDescription(value)} value={transactionDescription} />
							</Form.Field>
						</>
						)}
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
					<Button type='submit' color={getColor(transactionType)} onClick={handleSubmit}>Submit</Button>					
					</Form>
					</Segment>
				</div>
			</div>
		</div>
	);
}

function getCurrentDate() {
	const date = new Date();
	const year = date.getFullYear();
	const month = date.getMonth() + 1;
	const day = date.getDate();

	return `${year}-${month < 10 ? `0${month}` : `${month}`}-${day < 10 ? `0${day}` : `${day}`}`;
}

function getColor(transactionType) {
	switch (transactionType) {
		case "Income":
			return "green";
		case "Expense":
			return "red";
		case "Transfer-Out":
			return "blue";
		default:
			return "grey";
	}
}

function getAccounts(accounts) {
	return accounts.map((account) => {
		return {
			key: account.Account,
			text: account.Account,
			value: account.Account,
		};
	});
}

function getCategories(categories, type) {
	return categories
		.filter((category) => category.Type === type)
		.map((category) => {
			return {
				key: category.Category,
				text: category.Category,
				value: category.Category,
			};
		});
}

function getSuccessCode(successSubmitting, isSubmitting) {
	if (isSubmitting) {
		return "ui loading form";
	}

	if (successSubmitting) {
		return "ui success form";
	}

	if (successSubmitting === false) {
		return "ui error form";
	}

	return "";
}

export default AddTransaction;