import { StringifyTimeShort } from "../../Utils/Date";
import { ConvertTransactionCategory, PaginationState, TransactionCategory, TransactionTableOptions } from "../../Utils/Miscellaneous";
import { ConvertTransactions, Transaction } from "../../Utils/Transactions";
import { Options } from "./ChildComponents/Options";
import { Pagination } from "./ChildComponents/Pagination";

import { useEffect, useState } from "react";
import axios from "axios";

import { TransactionTable } from "../../Component/TransactionTable";;


export const TransactionView: React.FC<{ userID: string }> = ({ userID }): JSX.Element => {
  const [currentItems, setCurrentItems] = useState([] as Transaction[]);
  const [newSearch, setNewSearch] = useState(false);
	const [transactionCategories, setTransactionCategories] = useState([] as TransactionCategory[]);
	const [options, setOptions] = useState({
		transactionSort: "date",
		transactionType: "",
		transactionCategory: "",
		startDate: "",
		endDate: "",
	} as TransactionTableOptions);
	const [paginationState, setPaginationState] = useState({
		pageCount: 0,
		currPage: 0,
		itemOffset: 0,
		itemsPerPage: 15,
		totalItems: 0,
		showingItems: 0,
	} as PaginationState);

	useEffect(() => {    
    var params = new URLSearchParams();

		params.append('userID', userID)
		params.append('offset', paginationState.itemOffset.toString());
		params.append('limit', paginationState.itemsPerPage.toString());
		params.append('sort', options.transactionSort);
		params.append('transactionType', options.transactionType);
		params.append('transactionCategory', options.transactionCategory);
		params.append('startDate', options.startDate);
		params.append('endDate', options.endDate);

		axios.post("https://pktraffic.com/api/transactionsView.php", params).then(response => {
			setPaginationState({...paginationState,
				pageCount: Math.ceil(response.data.count / paginationState.itemsPerPage),
				totalItems: response.data.count,
				showingItems: response.data.transactions.length
			});
			setCurrentItems(ConvertTransactions(response.data.transactions));
		}).catch(response => {
			console.log(response);
		})
    
  }, [newSearch, options, userID]);

	const handlePageClick = (event: { selected: number; }) => {
		setPaginationState({...paginationState,
			currPage: event.selected,
			itemOffset: (event.selected * paginationState.itemsPerPage) % paginationState.totalItems
		});
  };

  const handleNewSearch = () => {
		setNewSearch(!newSearch);
		setPaginationState({...paginationState,
			currPage: 0,
			itemOffset: 0
		});
  }

	useEffect(() => {
		var params = new URLSearchParams();
		params.append('userID', userID);
	
		axios.post("https://pktraffic.com/api/transactionsViewType.php", params).then(response => {
			console.log(response.data)
			setTransactionCategories(ConvertTransactionCategory(response.data.types));
		}).catch(response => {
			console.log(response);
		})
	}, [userID]);

  return (
		<>
		<Options
			options={options}
			setOptions={setOptions}
			handleNewSearch={handleNewSearch}
			transactionCategories={transactionCategories}
		/>
		<TransactionTable
			transactions={currentItems}
		/>
		<Pagination
			state={paginationState}
			handlePageClick={handlePageClick}
		/>
		</>
	);
};
