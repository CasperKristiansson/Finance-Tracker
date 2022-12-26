import React, { useEffect, useState, useMemo } from 'react';
import './pagination.css';
import './options.css'
import { trackPromise } from 'react-promise-tracker';
import axios from 'axios';
import debounce from 'lodash.debounce';

import Options from './options';
import Table from './table';
import Pagination from './pagination';
import Loading from './loading';


export default (props) => {
  const itemsPerPage = 15;
  const [currentItems, setCurrentItems] = useState([]);
  const [pageCount, setPageCount] = useState(0);
  const [currPage, setCurrPage] = useState(0);  
  const [itemOffset, setItemOffset] = useState(0);
  const [recordsLength, setRecordsLength] = useState(0);
  const [newSearch, setNewSearch] = useState(false);
	const [option, setOption] = useState({
		sort: 'date',
		transactionType: 'all',
		transactionCategory: 'all',
		startDate: '',
		endDate: '',
	});


  useEffect(() => {    
    var params = new URLSearchParams();

    params.append('offset', itemOffset);
    params.append('limit', itemsPerPage);
		params.append('sort', option.sort);
		params.append('transactionType', option.transactionType);
		params.append('transactionCategory', option.transactionCategory);
		params.append('startDate', option.startDate);
		params.append('endDate', option.endDate);

    trackPromise(
      axios.post(props.endPoint, params).then(response => {
        console.log(response.data);
        if (response.data.count !== recordsLength) {
          setPageCount(Math.ceil(response.data.count / itemsPerPage));
          setRecordsLength(response.data.count);
        }
        setCurrentItems(response.data.crashes);
      }).catch(response => {
        console.log(response);
      })
    );
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemOffset, itemsPerPage, newSearch, props.endPoint]);

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

  const debouncedChangeHandler = useMemo(
    () =>
      debounce(() => {
        handleNewSearch();
      }, 1000),
    [handleNewSearch],
  );

  return (
    <div className="pagination-list pagination-dashboard">
      <Options
        option={option}
        setOption={setOption}
        newSearch={debouncedChangeHandler}
      />
      <Table
        data={currentItems}
      />
      <Loading />
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