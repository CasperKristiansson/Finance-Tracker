export interface DataPoint {
    x: string;
    y: number;
}
  
export class LinearRegression {
    private data: DataPoint[];
    private a: number;
    private b: number;
  
    constructor(data: DataPoint[]) {
        this.data = data;
        this.a = 0;
        this.b = 0;
        this.run();
    }
  
    private run() {
        let sumX = 0;
        let sumY = 0;
        let sumXY = 0;
        let sumX2 = 0;
        let n = this.data.length;
    
        this.data.forEach((point) => {
            let x = this.getMonthDifference(point.x);
            sumX += x;
            sumY += point.y;
            sumXY += x * point.y;
            sumX2 += x * x;
        });
    
        this.b = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        this.a = (sumY - this.b * sumX) / n;
    }
  
    private getMonthDifference(date: string): number {
        let start = new Date(this.data[0].x);
        let end = new Date(date);
        return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    }
  
    predict(months: number): number {
        return this.a + this.b * months;
    }
  
    predictMultiple(months: number[]): number[] {
        return months.map((month) => this.predict(month));
    }
}
  