import React from "react";
import ReactPaginate from 'react-paginate';
import { PaginationState } from "../../../Utils/Miscellaneous";
import { createUseStyles } from "react-jss";

const useStyles = createUseStyles({
	pagination: {
		margin: "0 auto",
		width: "fit-content",
		'& a': {
			color: "black",
			float: "left",
			padding: "8px 16px",
			textDecoration: "none",
		},
		'& li:last-child, & li:first-child': {
			backgroundColor: "#64C3FE",
			borderRadius: "5px",
			cursor: "pointer",
		},
		'& a:hover:not(.selected)': {
			backgroundColor: "#ddd",
			borderRadius: "5px",
		},
		'& ul': {
			listStyleType: "none",
			overflow: "hidden",
		},
		'& li': {
			display: "inline-block",
		},
		'& li:hover': {
			cursor: "pointer",
		},
		'& li:first-child': {
			position: "absolute",
			left: "295px",
		},
		'& li:last-child': {
			position: "absolute",
			right: "25px",
		},
		'& li.selected': {
			backgroundColor: "#64C3FE",
			borderRadius: "5px",
		},
		'& li.disabled': {
			backgroundColor: "#ddd !important",
			pointerEvents: "none",
		},
		'& li.selected a': {
			color: "white",
		},
		'& li.previous a': {
			color: "white",
		},
		'& li.next a': {
			color: "white",
		},
	},
	paginationControls: {
		paddingTop: "10px",
		paddingBottom: "10px",
	},
	showingText: {
		paddingTop: 20,
		fontSize: 16,	
	},
});

export const Pagination: React.FC<{state: PaginationState, handlePageClick: any}> = ({state, handlePageClick}): JSX.Element => {
	const classes = useStyles();
	
	return (
		<div className={classes.paginationControls}>
			<ReactPaginate
				breakLabel="..."
				nextLabel="next >"
				onPageChange={handlePageClick}
				pageRangeDisplayed={3}
				pageCount={state.pageCount === 0 ? 1 : state.pageCount}
				previousLabel="< previous"
				renderOnZeroPageCount={undefined}
				className={classes.pagination}
				forcePage={state.currPage}
			/>
			<div className="entires-text">
				<p className={classes.showingText}>Showing {state.showingItems ? state.showingItems : 0} of {state.totalItems} entries</p>
			</div>
		</div>
	);
};

export default Pagination;