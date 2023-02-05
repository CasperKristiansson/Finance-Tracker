import React from "react";
import { Bar } from "react-chartjs-2";

const BarChart = (props) => {
  const [data, setData] = React.useState({
    labels: [],
    datasets: [
      {
        data: [],
        backgroundColor: [],
        borderColor: [],
        borderWidth: 0,
      },
    ],
  });

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

    setData({
      labels: props.labels,
      datasets: [
        {
          label: "Expense",
          data: props.dataExpense,
          backgroundColor: backgroundColorIncome,
          borderColor: borderColorIncome,
          hoverBackgroundColor: hoverBackgroundColorIncome,
          hoverBorderColor: hoverBorderColorIncome,
          borderWidth: borderWidth,
        },
        {
          label: "Income",
          data: props.dataIncome,
          backgroundColor: backgroundColorExpense,
          borderColor: borderColorExpense,
          hoverBackgroundColor: hoverBackgroundColorExpense,
          hoverBorderColor: hoverBorderColorExpense,
          borderWidth: borderWidth,
        },
      ],
    });

  }, [props]);

  var options = {
    title: {
      display: true,
      text: "Income and Expenses",
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
      <h2>{props.title}</h2>
      <Bar data={data} options={options} height={props.height}/>
    </>
  );
};

export default BarChart;
