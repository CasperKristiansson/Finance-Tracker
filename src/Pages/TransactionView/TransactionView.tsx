import { ConvertTransactionCategory, PaginationState, TransactionCategory, TransactionTableOptions } from "../../Utils/Miscellaneous";
import { ConvertTransactions, Transaction } from "../../Utils/Transactions";
import { Options } from "./ChildComponents/Options";
import { Pagination } from "./ChildComponents/Pagination";

import React, { useEffect, useState } from "react";
import axios from "axios";

import { TransactionTable } from "../../Component/TransactionTable";;


export const TransactionView: React.FC<{ userID: string, setApiLoading: any }> = ({ userID, setApiLoading }): JSX.Element => {
  	const [currentItems, setCurrentItems] = useState([] as Transaction[]);
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
		setApiLoading(true);

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
			setPaginationState(pagination => ({...pagination,
				pageCount: Math.ceil(response.data.count / paginationState.itemsPerPage),
				totalItems: response.data.count,
				showingItems: response.data.transactions.length
			}));
			setCurrentItems(ConvertTransactions(response.data.transactions));
			setApiLoading(false);
		}).catch(response => {
			console.log(response);
			setApiLoading(false);
		})
    
  	}, [options, userID, paginationState.itemOffset, paginationState.itemsPerPage]);

	const handlePageClick = (event: { selected: number; }) => {
		setPaginationState({...paginationState,
			currPage: event.selected,
			itemOffset: (event.selected * paginationState.itemsPerPage) % paginationState.totalItems
		});
  	};

	const handleOptionsChange = (newOptions: TransactionTableOptions) => {
		setOptions(newOptions);
		setPaginationState({...paginationState, currPage: 0, itemOffset: 0});
	};

	useEffect(() => {
		var params = new URLSearchParams();
		params.append('userID', userID);
	
		axios.post("https://pktraffic.com/api/transactionsViewType.php", params).then(response => {
			setTransactionCategories(ConvertTransactionCategory(response.data.types));
		}).catch(response => {
			console.log(response);
		})
	}, [userID]);

  return (
		<>
		<h1>Transactions View</h1>
		<Options
			options={options}
			handleOptionsChange={handleOptionsChange}
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
