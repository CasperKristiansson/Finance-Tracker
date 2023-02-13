import { DataPoint } from "../Transactions";

export class TimeSeriesForecasting {
	data: DataPoint[];

	constructor(data: DataPoint[]) {
		this.data = data;
	}

	movingAverage(windowSize: number) {
		let movingAverage: number[] = [];
		for (let i = 0; i < this.data.length - windowSize + 1; i++) {
			let sum = 0;
			for (let j = 0; j < windowSize; j++) {
				sum += this.data[i + j].y;
			}
			movingAverage.push(sum / windowSize);
		}
		return movingAverage;
	}

	exponentialSmoothing(alpha: number) {
		let exponentialSmoothing: number[] = [];
		let prev = this.data[0].y;
		exponentialSmoothing.push(prev);
		for (let i = 1; i < this.data.length; i++) {
			let smoothed = alpha * this.data[i].y + (1 - alpha) * prev;
			exponentialSmoothing.push(smoothed);
			prev = smoothed;
		}
		return exponentialSmoothing;
	}

	forecast(forecastLength: number, method: string, windowSize?: number, alpha?: number) {
		let forecastedValues: number[] = [];
		switch (method) {
			case "movingAverage":
				let movingAverageData = this.movingAverage(windowSize!);
				for (let i = 0; i < forecastLength; i++) {
					forecastedValues.push(movingAverageData[movingAverageData.length - 1]);
				}
				break;
			case "exponentialSmoothing":
				let exponentialSmoothingData = this.exponentialSmoothing(alpha!);
				for (let i = 0; i < forecastLength; i++) {
					forecastedValues.push(exponentialSmoothingData[exponentialSmoothingData.length - 1]);
				}
				break;
			default:
				throw new Error("Invalid method");
		}
		return forecastedValues;
	}
}