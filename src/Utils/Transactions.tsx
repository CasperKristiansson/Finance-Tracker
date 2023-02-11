import { Milestone, milestones } from "./Data/Milestones";
import { MonthsLong, MonthsShort, StringifyTimeShort, StringifyTimeShortest } from "./Date";

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

export function TransactionsSort(transactions: Transaction[]): Transaction[] {
    return transactions.sort((a, b) => {
        return a.Date.getTime() - b.Date.getTime();
    });
}

export function TransactionsLoansSort(amounts: Transaction[] | Loan[]): Transaction[] | Loan[] {
    return amounts.sort((a, b) => {
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
    const income: number = TotalTransactionType(transactions, "Income");
    const expenses: number = TotalTransactionType(transactions, "Expense");

    return income - expenses;
}

export function TotalTransactionType(transactions: Transaction[], type: string): number {
    let total: number = 0;

    for (let i = 0; i < transactions.length; i++) {
        if (transactions[i].Type === type) {
            total += transactions[i].Amount;
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

// Convert Loans to Transactions
export function ConvertLoansToTransactions(loans: Loan[]): Transaction[] {
    let transactions: Transaction[] = [];

    for (let i = 0; i < loans.length; i++) {
        transactions.push({
            Account: "Loan",
            Amount: loans[i].Amount,
            Category: "Loan",
            Date: loans[i].Date,
            Note: "",
            Type: "Expense",
            ID: loans[i].ID,
        });
    }

    return transactions;
}

// Create a function that returns the transactions types specified
export function FilterTransactionsType(transactions: Transaction[], type: string): Transaction[] {
    let filteredTransactions: Transaction[] = [];

    filteredTransactions = transactions.filter((transaction) => {
        return transaction.Type === type;
    });

    return filteredTransactions;
}

export interface DropDown {
    key: string;
    text: string;
    value: string;
}

export function GetCategoriesMapping(categories: any, type: string): DropDown[] {
	return categories
		.filter((category: { Type: string; }) => category.Type === type)
		.map((category: { Category: any; }) => {
			return {
				key: category.Category,
				text: category.Category,
				value: category.Category,
			};
		});
}

export function GetAccountsMapping(accounts: any): DropDown[] {
	return accounts.map((account: { Account: any; }) => {
		return {
			key: account.Account,
			text: account.Account,
			value: account.Account,
		};
	});
}


/**
 * ? Line Chart Calculations
 */

function groupValuesMonth(amounts: Transaction[] | Loan[]): { [date: string]: number } {
    let groupedValues: { [date: string]: number } = {};

    amounts = TransactionsLoansSort(amounts);

    let firstDate: Date = amounts[0].Date;
    let lastDate: Date = amounts[amounts.length - 1].Date;

    let currentDate: Date = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);

    while (currentDate.getTime() <= lastDate.getTime()) {
        groupedValues[StringifyTimeShortest(currentDate)] = 0;
        currentDate.setMonth(currentDate.getMonth() + 1);
    }

    if (amounts[0].hasOwnProperty("Account")) {
        for (let i = 0; i < amounts.length; i++) {
            if (amounts[i].Type === "Income") groupedValues[StringifyTimeShortest(amounts[i].Date)] += amounts[i].Amount;
            else if (amounts[i].Type === "Expense") groupedValues[StringifyTimeShortest(amounts[i].Date)] -= amounts[i].Amount;
        }
    } else {
        for (let i = 0; i < amounts.length; i++) {
            groupedValues[StringifyTimeShortest(amounts[i].Date)] += amounts[i].Amount;
        }
    }

    return groupedValues;
}

function groupValuesMonthIterative(amounts: Transaction[] | Loan[]): { [date: string]: number } {
    let groupedValues: { [date: string]: number } = groupValuesMonth(amounts);

    let previousValue: number = 0;
    for (let date in groupedValues) {
        groupedValues[date] += previousValue;
        previousValue = groupedValues[date];
    }

    return groupedValues;
}

export function GetLineChartValues(amounts: Transaction[] | Loan[]): [string[], number[]] {
    let groupedValues: { [date: string]: number } = groupValuesMonthIterative(amounts);

    let dates: string[] = [""];
    let values: number[] = [0];

    for (let date in groupedValues) {
        dates.push(date);
        values.push(groupedValues[date]);
    }

    return [dates, values];
}

/**
 * ? Pie Chart Calculations
 */

/**
 * This function returns the categories of the transactions based on the month and type
 * @Returns an array of strings [category (percentage), category (percentage), ...]
 */
export function GetCategoriesLabels(transactions: Transaction[]): string[] {
	let categories: { [category: string]: number } = {};

	for (let i = 0; i < transactions.length; i++) {           
        if (!categories[transactions[i].Category]) {
            categories[transactions[i].Category] = transactions[i].Amount;
        } else {
            categories[transactions[i].Category] += transactions[i].Amount;
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

export function GetCategoriesAmount(transactions: Transaction[]): number[] {
    let categories: { [category: string]: number } = {};

	for (let i = 0; i < transactions.length; i++) {
        if (!categories[transactions[i].Category]) {
            categories[transactions[i].Category] = transactions[i].Amount;
        } else {
            categories[transactions[i].Category] += transactions[i].Amount;
        }
	}

  for (let category in categories) if (categories[category] < 0) delete categories[category];

	let result: number[] = [];

	for (let i in categories) result.push(categories[i]);

    if (result.length === 0) result.push(1);

	return result;
}

export function GetCategoriesAmountIncomeExpense(transactions: Transaction[]): [number, number] {
    let income: number = 0;
    let expense: number = 0;

    for (let i = 0; i < transactions.length; i++) {
        if (transactions[i].Type === "Income") income += transactions[i].Amount;
        else if (transactions[i].Type === "Expense") expense += transactions[i].Amount;
    }

    return [income, expense];
}

export function GetCategoriesLabelsIncomeExpense(transactions: Transaction[]): [string, string] {
    let incomeExpense: [number, number] = GetCategoriesAmountIncomeExpense(transactions);

    let total: number = incomeExpense[0] + incomeExpense[1];

    let incomeLabel: string = "Income (" + ( incomeExpense[0] / total * 100).toFixed(2) + "%)";
    let expenseLabel: string = "Expense (" + (incomeExpense[1] / total * 100).toFixed(2) + "%)";

    return [incomeLabel, expenseLabel];
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

export function ExpenseIncomeBarChart(transactions: Transaction[]): [string[], number[], number[]] {
    let years: number[] = [];
    let income: number[] = [];
    let expenses: number[] = [];

    for (let i = 0; i < transactions.length; i++) {
        let year: number = transactions[i].Date.getFullYear();
        if (!years.includes(year)) years.push(year);
    }

    years.sort((a, b) => a - b);

    for (let i = 0; i < years.length; i++) {
        income.push(0);
        expenses.push(0);
    }

    for (let i = 0; i < transactions.length; i++) {
        let year: number = transactions[i].Date.getFullYear();
        if (transactions[i].Type === "Income") income[years.indexOf(year)] += transactions[i].Amount;
        else if (transactions[i].Type === "Expense") expenses[years.indexOf(year)] += transactions[i].Amount;
    }


    return [years.map(year => year.toString()), income, expenses];
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

	transactions = TransactionsSort(transactions);

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
    transactions = TransactionsSort(transactions);

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



/**
 * ? Heatmap
 */

export interface HeatMapStruct {
    name: string;
    data: HeatMapData[];
}

interface HeatMapData {
    x: string;
    y: number;
}

export function GetHeatmap(transactions: Transaction[], type: string): HeatMapStruct[] {
    transactions = TransactionsSort(transactions);

    let heatmap: HeatMapStruct[] = [];
    
    for (let j = 0; j < 12; j++) {
        heatmap.push({
            name: MonthsLong[j],
            data: []
        });
    }

    let startYear: number = transactions[0].Date.getFullYear();
    let endYear: number = new Date().getFullYear();

    for (let i = startYear; i <= endYear; i++) {
        for (let j = 0; j < 12; j++) {
            let month: number = j + 1;

            let transactionsInMonth: Transaction[] = transactions.filter(transaction => {
                return transaction.Date.getFullYear() === i && transaction.Date.getMonth() + 1 === month;
            });

            let total: number = 0;
            for (let k = 0; k < transactionsInMonth.length; k++) {
                if (transactionsInMonth[k].Type === type) {
                    total += transactionsInMonth[k].Amount;
                }
            }

            heatmap[j].data.push({
                x: String(i),
                y: parseInt(total.toFixed(0))
            });
        }
    }

    return heatmap.reverse();
}

/**
 * ? Table
 */

export interface TableMonthStruct {
    row: string;
    data: number[];
}

export function GetTableYears(transactions: Transaction[], type: string): TableMonthStruct[] {
    let table: TableMonthStruct[] = [];
    transactions = TransactionsSort(transactions);

    let startYear: number = transactions[0].Date.getFullYear();
    let endYear: number = new Date().getFullYear();

    for (let i = startYear; i <= endYear; i++) {
        table.push({ row: String(i), data: [] as number[] });

        for (let j = 0; j < 12; j++) {
            let month: number = j + 1;
            let transactionsInMonth: Transaction[] = transactions.filter(transaction => {
                return transaction.Date.getFullYear() === i && transaction.Date.getMonth() + 1 === month;
            });

            let total: number = 0;
            for (let k = 0; k < transactionsInMonth.length; k++) {
                if (transactionsInMonth[k].Type === type) total += transactionsInMonth[k].Amount;
            }

            table[i - startYear].data.push(parseInt(total.toFixed(0)));
        }

        table[i - startYear].data.push(parseInt(table[i - startYear].data.reduce((a, b) => a + b, 0).toFixed(0)));
        table[i - startYear].data.push(parseInt((table[i - startYear].data.reduce((a, b) => a + b, 0) / 12).toFixed(0)));
    }

    table.push({ row: "Total", data: [] as number[] });
    table.push({ row: "Average", data: [] as number[] });

    for (let i = 0; i < 14; i++) {
        let total: number = 0;
        for (let j = 0; j < table.length - 2; j++) total += table[j].data[i];

        table[table.length - 2].data.push(parseInt(total.toFixed(0)));
        table[table.length - 1].data.push(parseInt((total / (endYear - startYear + 1)).toFixed(0)));
    }

    return table;
}

export interface TableCategoryStruct {
    columns: string[];
    rows: TableCategoryRow[];
}

interface TableCategoryRow {
    row: string;
    data: number[];
}

export function GetTableCategories(transactions: Transaction[], type: string): TableCategoryStruct {
    transactions = FilterTransactionsType(transactions, type);
    // Get all unique categories from transactions
    const categories: string[] = Array.from(new Set(transactions.map(t => t.Category)));

    // Get all unique years from transactions
    const years: string[] = Array.from(new Set(transactions.map(t => t.Date.getFullYear().toString())));

    // Create table categories struct with columns
    const tableCategories: TableCategoryStruct = {
        columns: ['Type', ...years, 'Total', 'Average'],
        rows: []
    };

    // For each category, calculate total and average amount for each year
    categories.forEach(category => {
        const categoryData: number[] = [];
        let categoryTotal: number = 0;

        years.forEach(year => {
            const yearTransactions = transactions.filter(t => t.Category === category && t.Date.getFullYear() === parseInt(year));
            const yearAmount = yearTransactions.reduce((sum: number, t: Transaction) => sum + t.Amount, 0);
            categoryData.push(yearAmount);
            categoryTotal += yearAmount;
        });

        tableCategories.rows.push({
            row: category,
            data: [...categoryData, categoryTotal, categoryTotal / years.length]
        });
    });

    // Add total and average rows
    const totalData: number[] = [];
    let total: number = 0;

    years.forEach(year => {
        const yearTransactions = transactions.filter(t => t.Date.getFullYear() === parseInt(year));
        const yearAmount = yearTransactions.reduce((sum: number, t: Transaction) => sum + t.Amount, 0);
        totalData.push(yearAmount);
        total += yearAmount;
    });

    tableCategories.rows.push({
        row: 'Total',
        data: [...totalData, total, total / years.length]
    });

    tableCategories.rows.push({
        row: 'Average',
        data: [...totalData.map(t => t / categories.length), total / categories.length, total / (categories.length * years.length)]
    });

    return tableCategories;
}

interface TableData {
    Income: number[];
    Expense: number[];
    NET: number[];
    EndBalance: number[];
}

export function NetChange(transactions: Transaction[]): TableCategoryStruct {
    const tableData: TableData = {
        Income: new Array(14).fill(0),
        Expense: new Array(14).fill(0),
        NET: new Array(14).fill(0),
        EndBalance: new Array(14).fill(0)
    };
  
    transactions.forEach(transaction => {  
        if (transaction.Type === "Income") {
            tableData.Income[transaction.Date.getMonth()] += transaction.Amount;
        } else if (transaction.Type === "Expense") {
            tableData.Expense[transaction.Date.getMonth()] += transaction.Amount;
        }
    });
  
    for (let i = 0; i < 14; i++) tableData.NET[i] = tableData.Income[i] - tableData.Expense[i];
  
    let endBalance = 0;
    for (let i = 0; i < 12; i++) {
        endBalance += tableData.NET[i];
        tableData.EndBalance[i] = endBalance;
    }
  
    let totalIncome = 0;
    let totalExpense = 0;
    let totalNet = 0;
    for (let i = 0; i < 12; i++) {
        totalIncome += tableData.Income[i];
        totalExpense += tableData.Expense[i];
        totalNet += tableData.NET[i];
    }
  
    tableData.Income[12] = totalIncome;
    tableData.Expense[12] = totalExpense;
    tableData.NET[12] = totalNet;
    tableData.Income[13] = totalIncome / 12;
    tableData.Expense[13] = totalExpense / 12;
    tableData.NET[13] = totalNet / 12;
  
    const tableCategories: TableCategoryStruct = {
        columns: ['Type', ...MonthsShort, 'Total', 'Average'],
        rows: []
    };

    for (const [key, value] of Object.entries(tableData)) {
        tableCategories.rows.push({
            row: key,
            data: value
        });
    }

    return tableCategories;
}


export function GetTableMonths(transactions: Transaction[], type: string): TableCategoryStruct {
    transactions = FilterTransactionsType(transactions, type);

    // Get all unique categories from transactions
    const categories: string[] = Array.from(new Set(transactions.map(t => t.Category)));

    // Create table categories struct with columns
    const tableCategories: TableCategoryStruct = {
        columns: ['Type', ...MonthsShort, 'Total', 'Average'],
        rows: []
    };

    // For each category, calculate total and average amount for each month
    categories.forEach(category => {
        const categoryData: number[] = [];
        let categoryTotal: number = 0;

        MonthsShort.forEach(month => {
            const monthTransactions = transactions.filter(t => t.Category === category && MonthsShort[t.Date.getMonth()] === month);
            const monthAmount = monthTransactions.reduce((sum: number, t: Transaction) => sum + t.Amount, 0);
            categoryData.push(monthAmount);
            categoryTotal += monthAmount;
        });

        tableCategories.rows.push({
            row: category,
            data: [...categoryData, categoryTotal, categoryTotal / MonthsShort.length]
        });
    });

    // Add total and average rows
    const totalData: number[] = [];
    let total: number = 0;

    MonthsShort.forEach(month => {
        const monthTransactions = transactions.filter(t => t.Date.toLocaleString("default", {month: "short"}) === month);
        const monthAmount = monthTransactions.reduce((sum: number, t: Transaction) => sum + t.Amount, 0);
        totalData.push(monthAmount);
        total += monthAmount;
    });

    tableCategories.rows.push({
        row: 'Total',
        data: [...totalData, total, total / MonthsShort.length]
    });

    tableCategories.rows.push({
        row: 'Average',
        data: [...totalData.map(t => t / categories.length), total / categories.length, total / (categories.length * MonthsShort.length)]
    });

    return tableCategories;
}