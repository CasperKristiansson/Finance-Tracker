export function GetTransactionColor(transactionType: string): string {
	switch(transactionType) {
		case "Income":
			return "positive"
		case "Expense":
			return "negative"
		default:
			return ""
	}
}

export function FormatNumber(number: number, decimal: number=0): string {
	return number.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: decimal});
}

export interface TransactionTableOptions {
	sort: string;
	transactionType: string;
	transactionCategory: string;
	startDate: Date | null;
	endDate: Date | null;
}

export interface PaginationState {
	pageCount: number;
	currPage: number;
	itemOffset: number;
	totalItems: number;
	showingItems: number;
	itemsPerPage: number;
}