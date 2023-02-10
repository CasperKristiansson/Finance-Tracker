import { useEffect, useState } from 'react';
import { Form, Select, Container } from 'semantic-ui-react'
import { sortOptions, transactionTypes } from '../../../Utils/Data/Table';
import { TransactionTableOptions } from '../../../Utils/Miscellaneous';

export const Options: React.FC<{ options: TransactionTableOptions, setOptions: any, handleNewSearch: any, transactionCategories: any }> = ({ options, setOptions, handleNewSearch, transactionCategories }): JSX.Element => {
	const [disTransactionCategories, setDisTransactionCategories] = useState([{ key: '', text: 'All', value: '' }]);

  const handleChange = (_event: any, { name, value }: any) => {
		if (name === 'transactionType') setOptions({ ...options, transactionCategory: '', [name]: value });
		else setOptions({ ...options, [name]: value });
  }

	useEffect(() => {	
		if (transactionCategories) {
			setDisTransactionCategories([ ...transactionCategories
				.filter((category: { Type: string; }) => {
					if (options.transactionType === '') {
						return true;
					} else {
						return category.Type.toLowerCase() === options.transactionType;
					}
				})
				.map((category: { Type: string; Category: string; }) => {
					return {
						key: category.Type + '-' + category.Category.toLowerCase(),
						text: category.Category + ' (' + category.Type + ')',
						value: category.Category.toLowerCase()
					}
				})])
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
				options={transactionCategories} placeholder='Select transaction category'
				name='transactionCategory' value={disTransactionCategories}
				onChange={handleChange}
			/>
          	<Form.Field control={Select} label='Sort By' options={sortOptions}
				placeholder='Select sort option' name='sort' value={options.sort}
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