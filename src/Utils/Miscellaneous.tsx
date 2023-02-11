export function GetTransactionColorType(transactionType: string): string {
	switch(transactionType) {
		case "Income":
			return "positive"
		case "Expense":
			return "negative"
		default:
			return "positive"
	}
}

export function GetSuccessCode(successSubmitting: boolean | null, isSubmitting: boolean) {
	if (isSubmitting) {
		return "ui loading form";
	}

	if (successSubmitting) {
		return "ui success form";
	}

	if (successSubmitting === false) {
		return "ui error form";
	}

	return "";
}

export function GetTransactionColors(transactionType: string) {
	switch (transactionType) {
		case "Income":
			return "green";
		case "Expense":
			return "red";
		case "Transfer-Out":
			return "blue";
		default:
			return "grey";
	}
}


export function FormatNumber(number: number, decimal: number=0): string {
	return number.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: decimal});
}

export interface TransactionTableOptions {
	transactionSort: string;
	transactionType: string;
	transactionCategory: string;
	startDate: string;
	endDate: string;
}

export interface PaginationState {
	pageCount: number;
	currPage: number;
	itemOffset: number;
	totalItems: number;
	showingItems: number;
	itemsPerPage: number;
}

export interface TransactionCategory {
	category: string;
	type: string;
}

export function ConvertTransactionCategory(transactionCategory: any[]): TransactionCategory[] {
	var result: TransactionCategory[] = [];
	for(var i=0; i<transactionCategory.length; i++) {
		result.push({
			category: transactionCategory[i].Category,
			type: transactionCategory[i].Type
		});
	}
	return result;
}
