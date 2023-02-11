import { useEffect, useState } from 'react';
import { Form, Select, Container } from 'semantic-ui-react'
import { sortOptions, transactionTypes } from '../../../Utils/Data/Table';
import { TransactionCategory, TransactionTableOptions } from '../../../Utils/Miscellaneous';

export const Options: React.FC<{ options: TransactionTableOptions, setOptions: any, handleNewSearch: any, transactionCategories: TransactionCategory[] }> = ({ options, setOptions, handleNewSearch, transactionCategories }): JSX.Element => {
	const [disTransactionCategories, setDisTransactionCategories] = useState([{ key: '', text: 'All', value: '' }]);

	const handleChange = (_event: any, { name, value }: any) => {
		if (name === 'transactionType') setOptions({ ...options, transactionCategory: '', [name]: value });
		else setOptions({ ...options, [name]: value });
	}

	useEffect(() => {	
		if (transactionCategories.length > 1) {
			setDisTransactionCategories([...transactionCategories.filter((category: { type: string; }) => {
				if (options.transactionType === '') {
					return true;
				} else {
					return category.type.toLowerCase() === options.transactionType;
				}
			}).map((category: { type: string; category: string; }) => {
				return {
					key: category.type + '-' + category.category.toLowerCase(),
					text: category.category + ' (' + category.type + ')',
					value: category.category.toLowerCase()
				}
			})]);
		}
	}, [options.transactionType, transactionCategories])

  return (
    <Container textAlign='center'>
      <Form>
        <Form.Group inline>
          	<Form.Field control={Select} label='Transaction Type'
				options={transactionTypes} placeholder='Select transaction type'
				name='transactionType' value={options.transactionType}
				onChange={handleChange}
			/>
          	<Form.Field control={Select} label='Transaction Category'
				options={disTransactionCategories} placeholder='Select transaction category'
				name='transactionCategory' value={options.transactionCategory}
				onChange={handleChange}
			/>
          	<Form.Field control={Select} label='Sort By' options={sortOptions}
				placeholder='Select sort option' name='sort' value={options.transactionSort}
				onChange={handleChange}
			/>
          	<Form.Input label='Start Date' type='date' name='startDate'
				value={options.startDate}
				onChange={handleChange}
			/>
          	<Form.Input label='End Date' type='date' name='endDate'
				value={options.endDate}
				onChange={handleChange}
			/>
        </Form.Group>
      </Form>
    </Container>
  )
};

export default Options;