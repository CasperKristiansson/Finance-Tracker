import React from "react";
import { Line } from "react-chartjs-2";

export interface LineChartStruct {
  labels: string[];
  data: number[];
}

export interface LineChartColor {
  backgroundColor: string;
  borderColor: string;
  hoverBackgroundColor: string;
  hoverBorderColor: string;
  borderWidth: number;
}

export const LineChart: React.FC<{ data: LineChartStruct, title: string, height: number | undefined, color: LineChartColor }> = ({ data, title, height, color }): JSX.Element => {
  const [dataSet, setDataSet] = React.useState({
    labels: [] as string[],
    datasets: [] as {}[],
  });

  React.useEffect(() => {
    setDataSet({
      labels: data.labels,
      datasets: [
        {
          label: title,
          data: data.data,
          backgroundColor: color.backgroundColor ? color.backgroundColor : "rgba(54, 162, 235, 0.2)",
          borderColor: color.borderColor ? color.borderColor : "rgba(54, 162, 235, 1)",
          hoverBackgroundColor: color.hoverBackgroundColor ? color.hoverBackgroundColor : "gba(54, 162, 235, 1)",
          hoverBorderColor: color.hoverBorderColor ? color.hoverBorderColor : "rgba(54, 162, 235, 1)",
          borderWidth: color.borderWidth ? color.borderWidth : 2,
        },
      ],
    });

  }, [data, color, title]);

  var options = {
    title: {
      display: true,
      text: title,
      fontSize: 25
    },
    legend: {
      display: true,
      position: "right"
    },
    scales: {
      x: {
        grid: {
          display: false
        }
      },
      y: {
        grid: {
          display: false
        }
      }
    }
  }

  return (
    <>
      <h2>{title}</h2>
      <Line data={dataSet as any} options={options} height={height}/>
    </>
  );
};

export default LineChart;
