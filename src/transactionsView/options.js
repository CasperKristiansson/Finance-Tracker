import { useEffect, useState } from 'react';
import { Form, Select, Container } from 'semantic-ui-react'

export default (props) => {
	const [transactionCategories, setTransactionCategories] = useState([]);

  const handleChange = (e, { name, value }) => {
		// If the user changes the transaction type, we need to reset the transaction category
		// Otherwise, the transaction category will be filtered by the old transaction type
		if (name === 'transactionType') {
			props.setOption({ ...props.option, transactionCategory: '', [name]: value });
		} else {
			props.setOption({ ...props.option, [name]: value });
		}
  }

	const sortOptions = [
		{ key: 'd', text: 'Date', value: 'date' },
		{ key: 'c', text: 'Amount', value: 'amount' },
	]

	const transactionTypes = [
		{ key: '', text: 'All', value: ''},
		{ key: 'i', text: 'Income', value: 'income' },
		{ key: 'e', text: 'Expense', value: 'expense' },
	]

	// The prop.transactionCategories contains a array of objects with the following structure:
	// { type: 'income', category: 'Salary' }
	// Convert this array of objects into an array of objects with the following structure:
	// { key: 'salary', text: 'Salary', value: 'salary' }
	// If props.option.transactionType is not empty, filter the array of objects by the type
	// If props.option.transactionType is empty, filter the array of all objects by the type

	useEffect(() => {	
		if (props.transactionCategories) {
			setTransactionCategories([{ key: '', text: 'All', value: '' }, ...props.transactionCategories
				.filter((category) => {
					if (props.option.transactionType === '') {
						return true;
					} else {
						return category.Type.toLowerCase() === props.option.transactionType;
					}
				})
				.map((category) => {
					// There might be multiple categories with the same name, but different types
					// For example, there might be an income category called 'Salary' and an expense category called 'Salary'
					// To avoid this, we need to add the type to the key and value
					// For example, the key and value for the income category 'Salary' will be 'income-salary'
					// The key and value for the expense category 'Salary' will be 'expense-salary'
					return {
						key: category.Type + '-' + category.Category.toLowerCase(),
						text: category.Category + ' (' + category.Type + ')',
						value: category.Category.toLowerCase()
					}
				})])
				// The first option in the array of objects is 'All'
		}

	}, [props.option.transactionType, props.transactionCategories])

  return (
    <Container textAlign='center'>
      <Form>
        <Form.Group inline>
          <Form.Field control={Select} label='Transaction Type' options={transactionTypes} placeholder='Select transaction type' name='transactionType' value={props.option.transactionType} onChange={handleChange} />
          <Form.Field control={Select} label='Transaction Category' options={transactionCategories} placeholder='Select transaction category' name='transactionCategory' value={props.option.transactionCategory} onChange={handleChange} />
          <Form.Field control={Select} label='Sort By' options={sortOptions} placeholder='Select sort option' name='sort' value={props.option.sort} onChange={handleChange} />
          <Form.Input label='Start Date' type='date' name='startDate' value={props.option.startDate} onChange={handleChange} />
          <Form.Input label='End Date' type='date' name='endDate' value={props.option.endDate} onChange={handleChange} />
        </Form.Group>
      </Form>
    </Container>
  )
}
