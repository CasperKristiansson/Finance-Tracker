export interface MonthYear {
	month: number;
	year: number;
}

export function getStartPeriod(): MonthYear {
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
