import React from "react";
import { Bar } from "react-chartjs-2";
import { createUseStyles } from "react-jss";

const useStyles = createUseStyles({
  hoverPointer: {
    "&:hover": {
      cursor: "pointer",
    },
  },
});

export interface BarChartStruct {
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

export const BarChart: React.FC<{ data: BarChartStruct, title: string, height: number | undefined, customClickEvent?: any }> = ({ data, title, height, customClickEvent }): JSX.Element => {
  const classes = useStyles();

  const [dataset, setDataset] = React.useState({
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

    setDataset({
      labels: data.labels,
      datasets: [
        {
          label: "Expense",
          data: data.expenseData,
          backgroundColor: backgroundColorIncome,
          borderColor: borderColorIncome,
          hoverBackgroundColor: hoverBackgroundColorIncome,
          hoverBorderColor: hoverBorderColorIncome,
          borderWidth: borderWidth,
        },
        {
          label: "Income",
          data: data.incomeData,
          backgroundColor: backgroundColorExpense,
          borderColor: borderColorExpense,
          hoverBackgroundColor: hoverBackgroundColorExpense,
          hoverBorderColor: hoverBorderColorExpense,
          borderWidth: borderWidth,
        },
      ],
    });

  }, [data]);

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
    },
    onClick: (event: any, element: any) => {
      if (element.length > 0 && customClickEvent) {
        customClickEvent(event, element);
      }
    }
  }

  return (
    <>
      <h2>{title}</h2>
      <Bar data={dataset} options={options} height={height} className={customClickEvent ? classes.hoverPointer: ""} />
    </>
  );
};
