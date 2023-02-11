import axios from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Form, Input, Message, Segment, TextArea } from "semantic-ui-react";
import { GetSuccessCode, GetTransactionColors } from "../../Utils/Miscellaneous";


export const EditAccount: React.FC<{ userID: string }> = ({ userID }): JSX.Element => {
	let navigate = useNavigate();

	const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
	const [transactionAmount, setTransactionAmount] = useState(0);
	const [transactionType, setTransactionType] = useState("Income");

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [successSubmitting, setSuccessSubmitting] = useState(null);


	const handleSubmit = () => {
		setIsSubmitting(true);
		var params = new URLSearchParams();

		const urlParams = new URLSearchParams(window.location.search);
		
		if (urlParams.get("account") === "Nordnet") {
			params.append('category', "Investment");
		} else if (urlParams.get("account") === "Danske Bank") {
			params.append('category', "Bospar");
		} else {
			params.append('category', "Adjustment");
		}

		params.append('date', transactionDate);
		params.append('description', "Adjustment From Account Menu");
		params.append('account', urlParams.get("account") as string);
		params.append('userID', userID);
		params.append('type', transactionType);

		let amount: number = 0;
	
		if (parseFloat(urlParams.get("balance") as string) < transactionAmount || urlParams.get("account") as string === "Nordnet" || urlParams.get("account") as string === "Danske Bank") {
			amount = transactionAmount - parseFloat(urlParams.get("balance") as string);
		} else {
			if (transactionAmount >= parseFloat(urlParams.get("balance") as string)) {
				amount = transactionAmount - parseFloat(urlParams.get("balance") as string);
			} else {
				amount = -1 * (transactionAmount - parseFloat(urlParams.get("balance") as string));
			}
		}

		params.append('amount', amount.toString());

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

	const handleTransactionAmountChange = (value: number) => {
		setTransactionAmount(value)
		const urlParams = new URLSearchParams(window.location.search);
	
		if (parseFloat(urlParams.get("balance") as string) < value || urlParams.get("account") as string === "Nordnet" || urlParams.get("account") as string === "Danske Bank") {
			setTransactionType("Income");
		} else {
			setTransactionType("Expense");
		}
	}

	return (
		<>
		<h1>Add New Transaction</h1>
		<div className="transaction-form">
		<Segment className={`ui ${GetTransactionColors(transactionType)}`}>
			<Form className={GetSuccessCode(successSubmitting, isSubmitting)}>
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
					<Input placeholder='New Account Amount' type="number" value={transactionAmount} onChange={(e, {value}) => handleTransactionAmountChange(parseFloat(value))}/>
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
			<Button type='submit' color={GetTransactionColors(transactionType)} onClick={handleSubmit}>Submit</Button>					
			</Form>
			</Segment>
		</div>
		</>
	);
}