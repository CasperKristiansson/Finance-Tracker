import { Milestone, milestones } from "./Data/Milestones";
import { StringifyTimeShort } from "./Date";

export interface Transaction {
    Account: string;
    Amount: number;
    Category: string;
    Date: Date;
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

        transactions.push({
            Account: data[i].Account,
            Amount: parseFloat(data[i].Amount),
            Category: data[i].Category,
            Date: new Date(data[i].Date),
            Note: data[i].Note,
            Type: data[i].Type,
            ID: data[i].id_incr,
        });
    }

    return transactions;
}


// This function filters the transactions based on the month provided.
// It iterates through the transactions and checks the month of the date of each one. If the month matches the month provided it adds the transaction to the filteredTransactions array.
// It returns the filteredTransactions array.
export function FilterTransactionsMonth(transactions: Transaction[], month: number): Transaction[] {
    let filteredTransactions: Transaction[] = [];

    filteredTransactions = transactions.filter((transaction) => {
        return transaction.Date.getMonth() === month;
    });

    return filteredTransactions;
}

export function TransactionsSortMonth(transactions: Transaction[]): Transaction[] {
    return transactions.sort((a, b) => {
        return a.Date.getTime() - b.Date.getTime();
    });
}

export interface Loan {
    Amount: number;
    Date: Date;
    Type: string;
    ID: number; 
}

export function ConvertLoans(data: any[]): Loan[] {
    let loans: Loan[] = [];

    if (data.length === 1) {
        if (data[0].Date === "" && data[0].Type === "" && data[0].Amount === "") {
            return [];
        }
    }

    for (var i = 0; i < data.length; i++) {
        if (!data[i].hasOwnProperty("date")) {
            return [];
        }
        if (!data[i].hasOwnProperty("type")) {
            return [];
        }
        if (!data[i].hasOwnProperty("amount")) {
            return [];
        }
        if (!data[i].hasOwnProperty("id_incr")) {
            return [];
        }

        loans.push({
            Amount: parseFloat(data[i].amount),
            Date: new Date(data[i].date),
            Type: data[i].type,
            ID: data[i].id_incr,
        });
    }

    return loans;
}

export function TotalAssets(transactions: Transaction[]): number {
    let total: number = 0;

    for (let i = 0; i < transactions.length; i++) {
        if (transactions[i].Type === "Income") {
            total += transactions[i].Amount;
        } else if (transactions[i].Type === "Expense") {
            total -= transactions[i].Amount;
        }
    }

    return total;
}

export function TotalLiabilities(loans: Loan[]): number {
    let total: number = 0;

    for (let i = 0; i < loans.length; i++) {
        total += loans[i].Amount;
    }

    return total;
}

export function TotalNetWorth(transactions: Transaction[], loans: Loan[]): number {
    return TotalAssets(transactions) - TotalLiabilities(loans);
}

/**
 * ? Pie Chart Calculations
 */

/**
 * This function returns the categories of the transactions based on the month and type
 * @Returns an array of strings [category (percentage), category (percentage), ...]
 */
export function GetCategoriesLabels(transactions: Transaction[], type: string): string[] {
	let categories: { [category: string]: number } = {};

	for (let i = 0; i < transactions.length; i++) {           
        if (transactions[i].Type === type) {
            if (!categories[transactions[i].Category]) {
                categories[transactions[i].Category] = transactions[i].Amount;
            } else {
                categories[transactions[i].Category] += transactions[i].Amount;
            }
        }
	}

    for (let category in categories) if (categories[category] < 0) delete categories[category];

	let categoriesTotal: number = 0;
	for (let i in categories) categoriesTotal += categories[i];

	let categoriesName: string[] = [];

	for (let i in categories) {
		categoriesName.push(i + " (" + (categories[i] / categoriesTotal * 100).toFixed(2) + "%)");
	}

    if (categoriesName.length === 0) categoriesName.push("No Income");

	return categoriesName;
}

export function GetCategoriesAmount(transactions: Transaction[], type: string): number[] {
    let categories: { [category: string]: number } = {};

	for (let i = 0; i < transactions.length; i++) {
        if (transactions[i].Type === type) {
            if (!categories[transactions[i].Category]) {
                categories[transactions[i].Category] = transactions[i].Amount;
            } else {
                categories[transactions[i].Category] += transactions[i].Amount;
            }
        }
	}

  for (let category in categories) if (categories[category] < 0) delete categories[category];

	let result: number[] = [];

	for (let i in categories) result.push(categories[i]);

    if (result.length === 0) result.push(1);

	return result;
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
export function GetMonthOfYearAmount(transactions: Transaction[], type: string, year: number=NaN): number[] {
    let result: number[] = [];
	for (let i = 0; i < 12; i++) result.push(0);

    if (year) {
        transactions = transactions.filter((transaction) => {
            return transaction.Date.getFullYear() === year;
        });
    }

	for (let i = 0; i < transactions.length; i++) {
		if (transactions[i].Type === type) {
			result[transactions[i].Date.getMonth()] += transactions[i].Amount;
		}
	}

	return result;
}


/**
 * ? Accounts
 */

export interface Account {
    Name: string;
    Balance: number;
}

/**
 * This function returns the balance of each account.
 * @returns Account[] -> [{Name: "Account Name", Balance: 0}, ...]
 */
export function GetAccountsBalance(transactions: Transaction[]): Account[] {
	let accounts: { [account: string]: number } = {};

	transactions.forEach(transaction => {
		if (transaction.Type === "Transfer-Out") {
			if (!accounts[transaction.Account]) accounts[transaction.Account] = -transaction.Amount;
			else accounts[transaction.Account] -= transaction.Amount;

            if (!accounts[transaction.Category]) accounts[transaction.Category] = transaction.Amount;
            else accounts[transaction.Category] += transaction.Amount;
		}
		else {
			if (transaction.Type === "Expense") transaction.Amount = -transaction.Amount;

            if (!accounts[transaction.Account]) accounts[transaction.Account] = transaction.Amount;
            else accounts[transaction.Account] += transaction.Amount;
		}
	});

	let result: Account[] = [];

    for (let i in accounts) {
        result.push({
            Name: i,
            Balance: accounts[i]
        });
    }

    return result;
}

export interface AccountGraph {
    Name: string;
    Balance: number[];
    Labels: string[];
}

/**
 * This function belongs to the page AccountsReport. This function returns an array of AccountGraph objects,
 * where each AccountGraph object contains the name of the account, the balance of the account, and
 * the labels of the account.
 * 
 * @returns AccountGraph[] -> [{Name: "Account Name", Balance: [0, 100, 200, ...], Labels: ["Jan 1", "Jan 2", "Jan 3", ...]}, ...]
 */
export function GetAccountsBalanceGraph(transactions: Transaction[]): AccountGraph[] {
    let accounts: { [account: string]: AccountGraph } = {};

	transactions = TransactionsSortMonth(transactions);

	transactions.forEach(transaction => {
		if (transaction.Type === "Transfer-Out") {
            if (!accounts[transaction.Account]) {
                accounts[transaction.Account] = {
                    Name: transaction.Account,
                    Balance: [-transaction.Amount],
                    Labels: [StringifyTimeShort(transaction.Date)]
                };
            } else {
                accounts[transaction.Account].Balance.push(
                    accounts[transaction.Account].Balance[accounts[transaction.Account].Balance.length - 1] - transaction.Amount
                );
                accounts[transaction.Account].Labels.push(StringifyTimeShort(transaction.Date));
            }

            if (!accounts[transaction.Category]) {
                accounts[transaction.Category] = {
                    Name: transaction.Category,
                    Balance: [transaction.Amount],
                    Labels: [StringifyTimeShort(transaction.Date)]
                };
            } else {
                accounts[transaction.Category].Balance.push(
                    accounts[transaction.Category].Balance[accounts[transaction.Category].Balance.length - 1] + transaction.Amount
                );
                accounts[transaction.Category].Labels.push(StringifyTimeShort(transaction.Date));
            }
		}
		else {
			if (transaction.Type === "Expense") transaction.Amount = -transaction.Amount;

            if (!accounts[transaction.Account]) {
                accounts[transaction.Account] = {
                    Name: transaction.Account,
                    Balance: [transaction.Amount],
                    Labels: [StringifyTimeShort(transaction.Date)]
                };
            } else {
                accounts[transaction.Account].Balance.push(
                    accounts[transaction.Account].Balance[accounts[transaction.Account].Balance.length - 1] + transaction.Amount
                );
                accounts[transaction.Account].Labels.push(StringifyTimeShort(transaction.Date));
            }
		}
	});

    let result: AccountGraph[] = [];

    for (let i in accounts) {
        let account: AccountGraph = accounts[i];

        account.Balance = account.Balance.slice(Math.max(account.Balance.length - 40, 0));
        account.Labels = account.Labels.slice(Math.max(account.Labels.length - 40, 0));
        result.push(account);
    }

    for (let i = 0; i < result.length; i++) {
        let labels = result[i].Labels;
        let newLabels: string[] = [];
        for (let j = 0; j < labels.length; j++) {
            if (j % Math.floor(labels.length / 7) === 0) newLabels.push(labels[j]);
            else newLabels.push("");
        }
        result[i].Labels = newLabels;
    }

	return result;
}

/**
 * ? Milestones
 */



export function GetMilestones(transactions: Transaction[]): Milestone[] {
    transactions = TransactionsSortMonth(transactions);

    let milestonesResult: Milestone[] = milestones;

    let total: number = 0;
	let date: Date = transactions[0].Date;
	for (var i = 0; i < transactions.length; i++) {
		if (transactions[i].Type === "Income") {
			total += transactions[i].Amount;
		} else if (transactions[i].Type === "Expense") {
			total -= transactions[i].Amount;
		} else {
			continue;
		}
		
        for (var j = 0; j < milestonesResult.length; j++) {
            if (total >= milestonesResult[j].Amount && !milestonesResult[j].Achieved) {
                milestonesResult[j].Achieved = true;
                milestonesResult[j].AchievedDate = transactions[i].Date;
                milestonesResult[j].TimeToAchieve  = Math.floor((transactions[i].Date.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

                date = transactions[i].Date;
            }
        }
	}

    return milestonesResult;
}
