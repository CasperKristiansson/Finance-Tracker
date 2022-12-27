import React from "react";
import ReactPaginate from 'react-paginate';

export default(props) => {
	return (
		<div className="pagination-controls">
			<ReactPaginate
				breakLabel="..."
				nextLabel="next >"
				onPageChange={props.handlePageClick}
				pageRangeDisplayed={3}
				pageCount={props.pageCount === 0 ? 1 : props.pageCount}
				previousLabel="< previous"
				renderOnZeroPageCount={null}
				className='pagination'
				forcePage={props.currPage}
			/>
			<div className="mobile-page-count">
				<p>{props.itemOffset / props.itemsPerPage + 1} / {props.pageCount}</p>
			</div>
			<div className="entires-text">
				<p>Showing {props.currentItems ? props.currentItems.length : 0} of {props.recordsLength} entries</p>
			</div>
		</div>
	);
};