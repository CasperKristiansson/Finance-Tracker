import React from "react";
import { Line } from "react-chartjs-2";

const LineChart = (props) => {
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
    var backgroundColorExpense = !props.colors ? "rgba(54, 162, 235, 0.2)" : props.colors.backgroundColorExpense;
    var borderColorExpense = !props.colors ? "rgba(54, 162, 235, 1)" : props.colors.borderColorExpense;
    var hoverBackgroundColorExpense = !props.colors ? "rgba(54, 162, 235, 1)" : props.colors.hoverBackgroundColorExpense;
    var hoverBorderColorExpense = !props.colors ? "rgba(54, 162, 235, 1)" : props.colors.hoverBorderColorExpense;
    var borderWidth = !props.colors ? 2 : props.colors.borderWidth;

    setData({
      labels: props.data[0],
      datasets: [
        {
          label: props.title,
          data: props.data[1],
          backgroundColor: backgroundColorExpense,
          borderColor: borderColorExpense,
          hoverBackgroundColor: hoverBackgroundColorExpense,
          hoverBorderColor: hoverBorderColorExpense,
          borderWidth: borderWidth,
        },
      ],
    });
  }, [props.data, props.colors, props.title]);

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

export default LineChart;
