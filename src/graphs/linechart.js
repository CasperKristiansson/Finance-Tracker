import React from "react";
import { Line } from "react-chartjs-2";

export default (props) => {
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

  console.log(props);

  var backgroundColorExpense = "rgba(54, 162, 235, 0.2)";
  var borderColorExpense = "rgba(54, 162, 235, 1)";
  var hoverBackgroundColorExpense = "rgba(54, 162, 235, 1)";
  var hoverBorderColorExpense = "rgba(54, 162, 235, 1)";
  var borderWidth = 1

  React.useEffect(() => {
    setData({
      labels: props.labels,
      datasets: [
        {
          label: "Wealth",
          data: props.data,
          backgroundColor: backgroundColorExpense,
          borderColor: borderColorExpense,
          hoverBackgroundColor: hoverBackgroundColorExpense,
          hoverBorderColor: hoverBorderColorExpense,
          borderWidth: borderWidth,
        },
      ],
    });
  }, [props.data]);

  var options = {
    title: {
      display: true,
      text: "Wealth",
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
      <Line data={data} options={options} />
    </>
  );
};
