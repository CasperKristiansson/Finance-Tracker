export interface Transaction {
    Account: string;
    Amount: number;
    Category: string;
    Date: string;
    Note: string;
    Type: string;
    ID: number;
}

export function ConvertTransactions(data: any[]): Transaction[] {
    let transactions: Transaction[] = [];

    if (data.length === 1) {
        if (data[0].Date === "" && data[0].Description === "" && data[0].Amount === "" && data[0].Type === "" && data[0].Category === "") {
            return [];
        }
    }

    for (var i = 0; i < data.length; i++) {
        if (!data[i].hasOwnProperty("Date")) {
            return [];
        }
        if (!data[i].hasOwnProperty("Type")) {
            return [];
        }
        if (!data[i].hasOwnProperty("Category")) {
            return [];
        }
        if (!data[i].hasOwnProperty("Amount")) {
            return [];
        }
        if (!data[i].hasOwnProperty("Description")) {
            data[i]["Description"] = "";
        }
        if (!data[i].hasOwnProperty("Account")) {
            return [];
        }

        if (typeof data[i].Date === "number") {
            data[i].Date = new Date((data[i].Date - (25567 + 2)) * 86400 * 1000);
            data[i].Date = data[i].Date.toISOString().slice(0, 10);
        }

        transactions.push({
            Account: data[i].Account,
            Amount: data[i].Amount,
            Category: data[i].Category,
            Date: data[i].Date,
            Note: data[i].Description,
            Type: data[i].Type,
            ID: data[i].id_incr,
        });
    }

    return data;
}
/**
 * ? Bar Chart Calculations
 */

/**
 * This function returns the total amount of money spent or received in each month of the year.
 * This function takes in an array of transactions and a string that indicates whether the function should return the amount spent or received. 
 * The function returns an array of numbers, where the first number is the total amount spent or received in January, the second number is the total amount spent or received in February, and so on.
 * @Returns Array of numbers [0,0,0, ...]
 */
export function GetMonthOfYearAmountType(transactions: Transaction[], type: string, year: number=NaN): number[] {
	let result: number[] = [];
	for (let i = 0; i < 12; i++) result.push(0);

    if (year) {
        transactions = transactions.filter((transaction) => {
            return new Date(transaction.Date).getFullYear() === year;
        });
    }

	for (let i = 0; i < transactions.length; i++) {
		if (transactions[i].Type === type) {
			result[new Date(transactions[i].Date).getMonth()] += transactions[i].Amount;
		}
	}

	return result;
}