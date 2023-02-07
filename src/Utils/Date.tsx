export const MonthsShort: string[] = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
export const MonthsLong: string[] = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export interface MonthYear {
	month: number;
	year: number;
}

export function GetStartPeriod(): MonthYear {
	var url: string = window.location.href;
	var params: URLSearchParams = new URLSearchParams(url.split("?")[1]);
	
	var monthStr: string | null = params.get("month");
	var yearStr: string | null = params.get("year");

	var monthYear: MonthYear = {
		month: new Date().getMonth() - 1,
		year: new Date().getFullYear(),
	};

	if (monthStr !== null) {
		var monthNum: number = parseInt(monthStr);
		if (monthNum > 0 || monthNum < 11) {
			monthYear.month = monthNum;
		}
	}

	if (yearStr !== null) {
		var yearNum: number = parseInt(yearStr);
		if (yearNum > 2018 || yearNum < new Date().getFullYear()) {
			monthYear.year = yearNum;
		}
	}

	return monthYear;
}

export function StringifyTime(date: Date): string {
	return (date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() +
        " " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds()
    );
};

export function stringifyTimeShort(date: Date): string {
	return (date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate()
	);
};
