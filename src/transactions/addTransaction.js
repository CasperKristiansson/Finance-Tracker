import React, {useEffect, useState} from "react";
import {
  Button,
  Checkbox,
  Form,
  Input,
  Radio,
  Select,
  TextArea,
} from 'semantic-ui-react'

import axios from 'axios';

export default () => {
	const [transactionType, setTransactionType] = useState("Income");
	const [transactionAmount, setTransactionAmount] = useState(0);
	const [transactionDate, setTransactionDate] = useState(new Date());
	const [transactionCategory, setTransactionCategory] = useState("");
	const [transactionDescription, setTransactionDescription] = useState("");
	const [transactionAccount, setTransactionAccount] = useState("");

	const handleChange = (e, { value }) => setTransactionType(value)

	return (
		<div className={"main-section"}>
			<div className={"main-section-content"}>
				<h1>Add New Transaction</h1>
				<div className="transaction-form">
					<Form>
						<label>Transaction Type</label>
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
								value='Transfer'
								onChange={handleChange}
								checked={transactionType === 'Transfer'}
							/>
						</Form.Group>

						{transactionType === "Transfer" ? (
							<>
								<Form.Field>
									<label>Date</label>
									<Input placeholder='Date' />
								</Form.Field>
								<Form.Field>
									<label>From</label>
									<Select placeholder='From' />
								</Form.Field>
								<Form.Field>
									<label>To</label>
									<Select placeholder='To' />
								</Form.Field>
								<Form.Field>
									<label>Amount</label>
									<Input placeholder='Amount' />
								</Form.Field>
								<Form.Field>
									<label>Note</label>
									<TextArea placeholder='Note' />
								</Form.Field>
								<Button type='submit'>Submit</Button>
							</>
						) : (
							<>
							<Form.Field>
								<label>Date</label>
								<Input placeholder='Date' />
							</Form.Field>
							<Form.Field>
								<label>Account</label>
								<Select placeholder='Account' />
							</Form.Field>
							<Form.Field>
								<label>Category</label>
								<Select placeholder='Category' />
							</Form.Field>
							<Form.Field>
								<label>Amount</label>
								<Input placeholder='Amount' />
							</Form.Field>
							<Form.Field>
								<label>Note</label>
								<TextArea placeholder='Note' />
							</Form.Field>
							<Button type='submit'>Submit</Button>
						</>
						)}						
					</Form>
				</div>
			</div>
		</div>
	);
}