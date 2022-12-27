import { Form, Select, Container } from 'semantic-ui-react'

const transactionTypes = [
	{ key: '', text: 'All', value: ''},
  { key: 'i', text: 'Income', value: 'income' },
  { key: 'e', text: 'Expense', value: 'expense' },
]

const transactionCategories = [
	{ key: '', text: 'All', value: ''},
  { key: 'r', text: 'Rent', value: 'rent' },
  { key: 's', text: 'Groceries', value: 'groceries' },
  { key: 'o', text: 'Other', value: 'other' },
]

const sortOptions = [
  { key: 'd', text: 'Date', value: 'date' },
  { key: 'c', text: 'Amount', value: 'amount' },
]

export default (props) => {
  const handleChange = (e, { name, value }) => {
    props.setOption({ ...props.option, [name]: value });
  }

  return (
    <Container textAlign='center'>
      <Form inline>
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
