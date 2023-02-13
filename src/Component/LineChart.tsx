import React from "react";
import { Line } from "react-chartjs-2";
import { createUseStyles } from "react-jss";

const useStyles = createUseStyles({
  hoverPointer: {
    "&:hover": {
      cursor: "pointer",
    },
  },
});

export interface LineChartStruct {
  labels: string[];
  data: number[];
  title: string;
  color: LineChartColor;
}

export interface LineChartColor {
  backgroundColor: string;
  borderColor: string;
  hoverBackgroundColor: string;
  hoverBorderColor: string;
  borderWidth: number;
}

export class LineChartColorS implements LineChartColor {
  backgroundColor: string = "rgb(33,133,208)";
  borderColor: string = "rgb(33,133,208)";
  hoverBackgroundColor: string = "rgb(33,133,208)";
  hoverBorderColor: string = "rgb(33,133,208)";
  borderWidth: number = 2;
}

export const LineChart: React.FC<{ data: LineChartStruct | LineChartStruct[], height: number | undefined, customClickEvent?: any, showRadius?: boolean, title: string }> = ({ data, height, customClickEvent, showRadius, title }): JSX.Element => {
  const classes = useStyles();
  
  const [dataSet, setDataSet] = React.useState({
    labels: [] as string[],
    datasets: [] as {}[],
  });

  React.useEffect(() => {
    if (Array.isArray(data)) {
      setDataSet({
        labels: data[0].labels,
        datasets: data.map((item, index) => {
          return {
            label: item.title,
            data: item.data,
            backgroundColor: item.color.backgroundColor,
            borderColor: item.color.borderColor,
            hoverBackgroundColor: item.color.hoverBackgroundColor,
            hoverBorderColor: item.color.hoverBorderColor,
            borderWidth: item.color.borderWidth,
          };
        }),
      });
    } else {
      setDataSet({
        labels: data.labels,
        datasets: [
          {
            label: data.title,
            data: data.data,
            backgroundColor: data.color.backgroundColor,
            borderColor: data.color.borderColor,
            hoverBackgroundColor: data.color.hoverBackgroundColor,
            hoverBorderColor: data.color.hoverBorderColor,
            borderWidth: data.color.borderWidth,
          },
        ],
      });
    }
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
    elements: {
      point: {
        radius: showRadius ? 0 : 3,
      },
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
      <Line data={dataSet as any} options={options} height={height} className={customClickEvent ? classes.hoverPointer : ""}/>
    </>
  );
};

export default LineChart;
