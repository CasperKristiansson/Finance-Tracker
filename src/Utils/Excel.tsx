import axios from 'axios';
import { Message } from "semantic-ui-react";

export interface ExcelUpload {
	success: boolean;
	errorMessage: string;
	errorElement: JSX.Element | null;
}

export function handleExcelSubmit(userID: string): ExcelUpload {
	var result: ExcelUpload = {
		success: true,
		errorMessage: "",
		errorElement: null
	};

	var XLSX = require("xlsx");

	var input: HTMLInputElement = document.createElement('input');
	input.type = 'file';
	input.accept = '.xlsx';

	input.onchange = e => {
		var input = e.target as HTMLInputElement;

		if (!input || !input.files) {
			return { success: false, errorMessage: "No file selected" };
		}
		
		var file: File = input.files[0];
		var reader: FileReader = new FileReader();

		reader.readAsBinaryString(file);

		reader.onload = function (e) {
			if (!e.target) {
				return { success: false, errorMessage: "No file selected" };
			}

			var data = e.target.result;
			var workbook = XLSX.read(data, {
				type: 'binary'
			});
			var sheetName: string = workbook.SheetNames[0];
			var sheet = workbook.Sheets[sheetName];
			const excelData = XLSX.utils.sheet_to_json(sheet);

			const validatedData: DataValidation = validateData(excelData);

			if (!validatedData.errorMessage || !data) {
				return { success: false, errorMessage: validatedData.errorMessage };
			};

			var params = new URLSearchParams();
			params.append('transactions', JSON.stringify(validatedData.data));
			params.append('userID', userID);

			axios.post('https://pktraffic.com/api/addTransactions.php', params).then(response => {
				console.log(response.data);
				if (response.data.success) {
					result.errorElement = (
						<>
						<Message positive>
							<Message.Header>Upload Complete</Message.Header>
							<p>
								The excel document was <b>successfully</b> uploaded!
							</p>
						</Message>
						</>
					);
				} else {
					result.errorElement = (
						<>
						<Message negative>
							<Message.Header>Upload Failed</Message.Header>
							<p>
								There was a database error. Please try again later.
							</p>
						</Message>
						</>
					);
				}
			}).catch(response => {
				console.log(response);
			})
			}				
		}
	input.click();

	return result;
}


interface DataValidation {
	data: any[];
	errorMessage: string;
}

function validateData(data: any[]): DataValidation {
	if (data.length === 1) {
		if (data[0].Date === "" && data[0].Description === "" && data[0].Amount === "" && data[0].Type === "" && data[0].Category === "") {
			return {"data": [], "errorMessage": "No data in file"};
		}
	}

	for(var i = 0; i < data.length; i++) {
		if (!data[i].hasOwnProperty("Date")) {
			return {"data": [], "errorMessage": "Date is missing at row " + (i + 1)};
		}
		if (!data[i].hasOwnProperty("Type")) {
			return {"data": [], "errorMessage": "Type is missing at row " + (i + 1)};
		}
		if (!data[i].hasOwnProperty("Category")) {
			return {"data": [], "errorMessage": "Category is missing at row " + (i + 1)};
		}
		if (!data[i].hasOwnProperty("Amount")) {
			return {"data": [], "errorMessage": "Amount is missing at row " + (i + 1)};
		}
		if (!data[i].hasOwnProperty("Description")) {
			data[i]["Description"] = "";
		}
		if (!data[i].hasOwnProperty("Account")) {
			return {"data": [], "errorMessage": "Account is missing at row " + (i + 1)};
		}

		if (typeof data[i].Date === "number") {
			data[i].Date = new Date((data[i].Date - (25567 + 2)) * 86400 * 1000);
			data[i].Date = data[i].Date.toISOString().slice(0, 10);
		}

		var date = new Date(data[i]["Date"]);
		var year = date.getFullYear();
		var month = date.getMonth() + 1;
		var day = date.getDate();
		var hour = date.getHours();
		var minute = date.getMinutes();
		var second = date.getSeconds();


		data[i]["Date"] = year + "-" + month + "-" + day + " " + hour + ":" + minute + ":" + second;
	}

	return {"data": data, "errorMessage": ""};
}
