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

  if (!props.colors) {
    var backgroundColorExpense = "rgba(54, 162, 235, 0.2)";
    var borderColorExpense = "rgba(54, 162, 235, 1)";
    var hoverBackgroundColorExpense = "rgba(54, 162, 235, 1)";
    var hoverBorderColorExpense = "rgba(54, 162, 235, 1)";
    var borderWidth = 2
  } else {
    var backgroundColorExpense = props.colors.backgroundColorExpense;
    var borderColorExpense = props.colors.borderColorExpense;
    var hoverBackgroundColorExpense = props.colors.hoverBackgroundColorExpense;
    var hoverBorderColorExpense = props.colors.hoverBorderColorExpense;
    var borderWidth = props.colors.borderWidth
  }
  

  React.useEffect(() => {
    setData({
      labels: props.labels,
      datasets: [
        {
          label: props.title,
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
      text: props.title,
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
      <Line data={data} options={options} height={props.height}/>
    </>
  );
};
