import React, { useEffect, useState } from 'react';
import './pagination.css';
import axios from 'axios';

import Table from './table';
import Pagination from './pagination';


export default (props) => {
  const itemsPerPage = 15;
  const [currentItems, setCurrentItems] = useState([]);
  const [pageCount, setPageCount] = useState(0);
  const [currPage, setCurrPage] = useState(0);  
  const [itemOffset, setItemOffset] = useState(0);
  const [recordsLength, setRecordsLength] = useState(0);
  const [newSearch, setNewSearch] = useState(false);
	const [option, setOption] = useState({
		sort: 'Date',
		transactionType: '',
		transactionCategory: '',
		startDate: '',
		endDate: '',
	});

  useEffect(() => {    
    var params = new URLSearchParams();

		params.append('userID', props.userID)
    params.append('offset', itemOffset);
    params.append('limit', itemsPerPage);
		params.append('sort', option.sort);
		params.append('transactionType', option.transactionType);
		params.append('transactionCategory', option.transactionCategory);
		params.append('startDate', option.startDate);
		params.append('endDate', option.endDate);

		axios.post("https://pktraffic.com/api/transactionsView.php", params).then(response => {
			console.log(response.data);
			if (response.data.count !== recordsLength) {
				setPageCount(Math.ceil(response.data.count / itemsPerPage));
				setRecordsLength(response.data.count);
			}
			setCurrentItems(response.data.transactions);
		}).catch(response => {
			console.log(response);
		})
    
  }, [itemOffset, itemsPerPage, newSearch]);

  useEffect(() => {
    setCurrentItems([]);
    setItemOffset(0);
    setCurrPage(0);
  }, [props.endPoint]);

  const handlePageClick = (event) => {
    const newOffset = (event.selected * itemsPerPage) % recordsLength;
    setCurrPage(event.selected);
    setItemOffset(newOffset);
  };

  const handleNewSearch = () => {
		setNewSearch(!newSearch);
    setCurrPage(0);
    setItemOffset(0);
  } 

  return (
    <div className="pagination-list pagination-dashboard">
      <Table
        data={currentItems}
      />
      <Pagination
        pageCount={pageCount}
        currPage={currPage}
        handlePageClick={handlePageClick}
        itemOffset={itemOffset}
        itemsPerPage={itemsPerPage}
        recordsLength={recordsLength}
        currentItems={currentItems}
      />
    </div>
  );
};