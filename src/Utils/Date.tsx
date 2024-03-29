export const MonthsShort: string[] = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MonthsLong: string[] = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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

export function GetStartType(): string {
	var url: string = window.location.href;
	var params: URLSearchParams = new URLSearchParams(url.split("?")[1]);
	// Check for a params called "type"
	var type: string | null = params.get("type");
	if (type !== null) {
		return type;
	}

	return "Income";
}

export function GetStartYear(): number {
	var url: string = window.location.href;
	var params: URLSearchParams = new URLSearchParams(url.split("?")[1]);
	var year: string | null = params.get("year");
	if (year !== null) {
		return parseInt(year);
	}

	return new Date().getFullYear();
}

export function StringifyTime(date: Date): string {
	return (date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() +
        " " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds()
    );
};

export function StringifyTimeShort(date: Date): string {
	let month: string = (date.getMonth() + 1).toString();
	if (month.length < 2) month = "0" + month;

	let day: string = date.getDate().toString();
	if (day.length < 2) day = "0" + day;

	return (date.getFullYear() + "-" + month + "-" + day);
};

export function StringifyTimeShortest(date: Date): string {
	let month: string = (date.getMonth() + 1).toString();
	if (month.length < 2) month = "0" + month;
	
	return (date.getFullYear() + "-" + month);
};
