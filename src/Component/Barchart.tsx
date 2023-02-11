import React from "react";
import { Bar } from "react-chartjs-2";

export interface BarChartProps {
  labels: string[];
  incomeData: number[];
  expenseData: number[];
}

interface BarChartState {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string;
    borderColor: string;
    hoverBackgroundColor: string;
    hoverBorderColor: string;
    borderWidth: number;
  }[];
}

export const BarChart: React.FC<{ barChart: BarChartProps, title: string, height: number | undefined }> = ({ barChart, title, height }): JSX.Element => {
  const [data, setData] = React.useState({
    labels: [],
    datasets: [
      {
        label: "Loading...",
        data: [],
        backgroundColor: "",
        borderColor: "",
        hoverBackgroundColor: "",
        hoverBorderColor: "",
        borderWidth: 0,
      },
    ],
  } as BarChartState);

  React.useEffect(() => {
    var backgroundColorIncome = "rgba(255, 99, 132, 0.2)";
    var borderColorIncome = "rgba(255, 99, 132, 1)";
    var hoverBackgroundColorIncome = "rgba(255, 99, 132, 1)";
    var hoverBorderColorIncome = "rgba(255, 99, 132, 1)";

    var backgroundColorExpense = "rgba(54, 162, 235, 0.2)";
    var borderColorExpense = "rgba(54, 162, 235, 1)";
    var hoverBackgroundColorExpense = "rgba(54, 162, 235, 1)";
    var hoverBorderColorExpense = "rgba(54, 162, 235, 1)";
    var borderWidth = 1

    console.log(barChart)

    setData({
      labels: barChart.labels,
      datasets: [
        {
          label: "Expense",
          data: barChart.expenseData,
          backgroundColor: backgroundColorIncome,
          borderColor: borderColorIncome,
          hoverBackgroundColor: hoverBackgroundColorIncome,
          hoverBorderColor: hoverBorderColorIncome,
          borderWidth: borderWidth,
        },
        {
          label: "Income",
          data: barChart.incomeData,
          backgroundColor: backgroundColorExpense,
          borderColor: borderColorExpense,
          hoverBackgroundColor: hoverBackgroundColorExpense,
          hoverBorderColor: hoverBorderColorExpense,
          borderWidth: borderWidth,
        },
      ],
    });

  }, [barChart]);

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
      <Bar data={data} options={options} height={height}/>
    </>
  );
};

