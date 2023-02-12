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
  var baseDataSet = {
    labels: [] as string[],
    datasets: [
      {
        label: "Loading...",
        data: [] as number[],
        backgroundColor: "rgba(54, 162, 235, 0.2)",
        borderColor: "rgba(54, 162, 235, 1)",
        hoverBackgroundColor: "gba(54, 162, 235, 1)",
        hoverBorderColor: "rgba(54, 162, 235, 1)",
        borderWidth: 2,
      },
    ],
  }

  const [dataSet, setDataSet] = React.useState(baseDataSet);

  React.useEffect(() => {
    setDataSet({
      labels: data.labels,
      datasets: [
        {
          label: title,
          data: data.data,
          backgroundColor: color.backgroundColor ? color.backgroundColor : baseDataSet.datasets[0].backgroundColor,
          borderColor: color.borderColor ? color.borderColor : baseDataSet.datasets[0].borderColor,
          hoverBackgroundColor: color.hoverBackgroundColor ? color.hoverBackgroundColor : baseDataSet.datasets[0].hoverBackgroundColor,
          hoverBorderColor: color.hoverBorderColor ? color.hoverBorderColor : baseDataSet.datasets[0].hoverBorderColor,
          borderWidth: color.borderWidth ? color.borderWidth : baseDataSet.datasets[0].borderWidth,
        },
      ],
    });

  }, [data, color, title, baseDataSet.datasets]);

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
