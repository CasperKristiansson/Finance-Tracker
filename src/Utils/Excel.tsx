import axios from 'axios';
import { Message } from "semantic-ui-react";

import * as FileSaver from "file-saver";
import * as XLSX from "xlsx";

export interface ExcelUploadData {
	success: boolean;
	errorMessage: string;
	messageElement: JSX.Element | null;
}

/**
 * Uploads an excel file in the form as a json object
 */
export function ExcelUpload(userID: string): Promise<ExcelUploadData> {
	return new Promise((resolve, reject) => {
	  var result: ExcelUploadData = {
		success: true,
		errorMessage: "",
		messageElement: null
	  };
  
	  var XLSX = require("xlsx");
  
	  var input: HTMLInputElement = document.createElement('input');
	  input.type = 'file';
	  input.accept = '.xlsx';
  
	  input.onchange = e => {
		var input = e.target as HTMLInputElement;
  
		if (!input || !input.files) {
			result.messageElement = (
				<Message negative>
					<Message.Header>Invalid File (1)</Message.Header>
					<p>No file selected</p>
				</Message>
			);
		  result.success = false;
			result.errorMessage = "No file selected";

			reject(result);
			return result;
		}

		if (!input.files) {
			result.messageElement = (
				<Message negative>
					<Message.Header>Invalid File (2)</Message.Header>
					<p>No file selected</p>
				</Message>
		  );
		  result.success = false;
		  result.errorMessage = "No file selected";

		  reject(result);
			return result;
		}
		
		var file: File = input.files[0];
		var reader: FileReader = new FileReader();
  
		reader.readAsBinaryString(file);
  
		reader.onload = function (e) {
		  if (!e.target) {
				result.messageElement = (
					<Message negative>
						<Message.Header>Invalid File (3)</Message.Header>
						<p>No file selected</p>
					</Message>
				);
				result.success = false;
				result.errorMessage = "No file selected";

				reject(result);
				return result;
			}
  
		  var data = e.target.result;
		  var workbook = XLSX.read(data, {
			type: 'binary'
		  });
		  var sheetName: string = workbook.SheetNames[0];
		  var sheet = workbook.Sheets[sheetName];
		  const excelData = XLSX.utils.sheet_to_json(sheet);
  
		  const validatedData: DataValidation = validateData(excelData);
  
		  if (validatedData.errorMessage || !data) {
				result.messageElement = (
					<Message negative>
						<Message.Header>Invalid File (4)</Message.Header>
							<p>{validatedData.errorMessage}</p>
					</Message>
				);
				result.success = false;
				result.errorMessage = validatedData.errorMessage;

				reject(result);
				return result;
		  };
  
		  var params = new URLSearchParams();
		  params.append('transactions', JSON.stringify(validatedData.data));
		  params.append('userID', userID);
  
		  axios.post('https://pktraffic.com/api/addTransactions.php', params)
			.then(response => {
			  if (response.data.success) {
					result.messageElement = (
						<>
							<Message positive>
								<Message.Header>Upload Complete</Message.Header>
								<p>
									The excel document was <b>successfully</b> uploaded!
								</p>
							</Message>
						</>
					);
					resolve(result);
					return result;
			  } else {
					result.messageElement = (
						<>
						<Message negative>
							<Message.Header>Upload Failed</Message.Header>
							<p>
								There was a database error. Please try again later.
							</p>
							</Message>
						</>
					);
					result.success = false;
					result.errorMessage = "Database Error";

					resolve(result);
					return result;
			  }
			})
			.catch(response => {
			  console.log(response);
			  result.messageElement = (
				<>
					<Message negative>
						<Message.Header>Upload Failed</Message.Header>
						<p>
							There was a database error. Please try again later. {response}
						</p>
					</Message>
				</>
				);
				result.success = false;
				result.errorMessage = response;

				resolve(result);
				return result;
			});
		  }        
		}
	  input.click();
	});
  }


interface DataValidation {
	data: any[];
	errorMessage: string;
}

/**
 * Validates the data from the excel file
 */
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

/**
 * Downloads a template for the transaction excel file
 */
export function DownloadTransactionTemplate(): void {
	const jsonFormat: any[] = [
		{
			"Date": "",
			"Description": "",
			"Category": "",
			"Type": "",
			"Amount": "",
			"Account": "",
		}
	];

	const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(jsonFormat);
	const wb: XLSX.WorkBook = { Sheets: { data: ws }, SheetNames: ["data"] };
	const excelBuffer: any = XLSX.write(wb, { bookType: "xlsx", type: "array" });
	const data: Blob = new Blob([excelBuffer], { type: 'xlsx' });

	var date: Date = new Date();
	var fileName: string = "Transactions_" + date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + ".xlsx";
	FileSaver.saveAs(data, fileName);
}

/**
 * This function downloads the transactions to an excel file
 */
export function DownloadTransactions(transactions: any, fileName: string): void {
	const ws = XLSX.utils.json_to_sheet(transactions);
	const wb: XLSX.WorkBook = { Sheets: { data: ws }, SheetNames: ["data"] };
	const excelBuffer: any = XLSX.write(wb, { bookType: "xlsx", type: "array" });
	const data: Blob = new Blob([excelBuffer], { type: 'xlsx' });
	FileSaver.saveAs(data, fileName);
}
