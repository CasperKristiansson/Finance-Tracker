import React, {useEffect, useState} from "react";
import { Button, Form, Input, Segment, TextArea, Message } from 'semantic-ui-react'
import { useNavigate } from "react-router-dom";
import axios from 'axios';
import './transaction.css'


const EditAccount = (props) => {
	const [transactionType, setTransactionType] = useState("Income");
	const [oldTransactionAmount, setOldTransactionAmount] = useState("");
	const [transactionAmount, setTransactionAmount] = useState("");
	const [transactionDate, setTransactionDate] = useState(getCurrentDate());
	const [transactionCategory, setTransactionCategory] = useState("");
	const [transactionDescription, setTransactionDescription] = useState("");
	const [transactionAccount, setTransactionAccount] = useState("");

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [successSubmitting, setSuccessSubmitting] = useState(null);

	let navigate = useNavigate();

	useEffect(() => {
		const urlParams = new URLSearchParams(window.location.search);
		setTransactionAccount(urlParams.get("account"));
		setOldTransactionAmount(urlParams.get("balance"));

		if (urlParams.get("account") === "Nordnet") {
			setTransactionCategory("Investment");
			setTransactionType("Income");
		} else if (urlParams.get("account") === "Danske Bank") {
			setTransactionCategory("Bospar");
			setTransactionType("Income");
		} else {
			setTransactionCategory("Adjustment");
			setTransactionType("Expense");
		}
	}, []);

	const handleSubmit = () => {
		setIsSubmitting(true);
		var params = new URLSearchParams();
		params.append('type', transactionType);
		params.append('date', transactionDate);
		params.append('category', transactionCategory);
		params.append('description', transactionDescription);
		params.append('account', transactionAccount);
		params.append('userID', props.userID);

		var amount = 0;
		if (transactionType === "Income") {
			amount = transactionAmount - oldTransactionAmount;
		} else {
			// Check if transactionAmount is bigger than oldTransactionAmount
			if (transactionAmount > oldTransactionAmount) {
				amount = transactionAmount - oldTransactionAmount;
			} else {
				amount = oldTransactionAmount - transactionAmount;
				// if amount is negative, make it positive
				if (amount < 0) {
					amount = amount * -1;
				}
			}
		}

		params.append('amount', amount);


		axios.post('https://pktraffic.com/api/addTransaction.php', params).then(response => {
			setIsSubmitting(false);
			setSuccessSubmitting(response.data.success);

			setTimeout(() => {
				navigate("/accounts");
			}, 3000);
		}).catch(response => {
			console.log(response);
			setIsSubmitting(false);
		});
	}

	const handleTransactionAmountChange = (value) => {
		setTransactionAmount(value);
		// Check if oldTransactionAmount is less than transactionAmount
		if (oldTransactionAmount < value || transactionAccount === "Nordnet" || transactionAccount === "Danske Bank") {
			setTransactionType("Income");
		} else {
			setTransactionType("Expense");
		}
	}

	return (
		<div className={"main-section"}>
			<div className={"main-section-content"}>
				<h1>Add New Transaction</h1>
				<div className="transaction-form">
				<Segment className={`ui ${getColor(transactionType)}`}>
					<Form className={getSuccessCode(successSubmitting, isSubmitting)}>
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
						<Form.Field>
							<label>New Account Amount</label>
							<Input placeholder='New Account Amount' type="number" value={transactionAmount} onChange={(e, {value}) => handleTransactionAmountChange(value)}/>
						</Form.Field>
						<Form.Field>
							<label>Note</label>
							<TextArea placeholder='Note' onChange={(e, {value}) => setTransactionDescription(value)} value={transactionDescription} />
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

export default EditAccount;
