import React from 'react';
import { Pie } from 'react-chartjs-2';

const PieChart = (props) => {
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
    var backgroundColor = [
      'rgba(54, 162, 235, 0.2)',
      'rgba(255, 99, 132, 0.2)',
      'rgba(255, 206, 86, 0.2)',
      'rgba(75, 192, 192, 0.2)',
      'rgba(153, 102, 255, 0.2)',
      'rgba(255, 159, 64, 0.2)',
    ]
    var borderColor = [
      'rgba(54, 162, 235, 1)',
      'rgba(255, 99, 132, 1)',
      'rgba(255, 206, 86, 1)',
      'rgba(75, 192, 192, 1)',
      'rgba(153, 102, 255, 1)',
      'rgba(255, 159, 64, 1)',
    ]
    var hoverBackgroundColor = [
      'rgba(54, 162, 235, 1)',
      'rgba(255, 99, 132, 1)',
      'rgba(255, 206, 86, 1)',
      'rgba(75, 192, 192, 1)',
      'rgba(153, 102, 255, 1)',
      'rgba(255, 159, 64, 1)',
    ]
    var hoverBorderColor = [
      'rgba(54, 162, 235, 1)',
      'rgba(255, 99, 132, 1)',
      'rgba(255, 206, 86, 1)',
      'rgba(75, 192, 192, 1)',
      'rgba(153, 102, 255, 1)',
      'rgba(255, 159, 64, 1)',
    ]
    var borderWidth = 1

    setData({
      labels: props.labels,
      datasets: [
        {
          data: props.data,
          backgroundColor: backgroundColor,
          borderColor: borderColor,
          borderWidth: borderWidth,
          hoverBorderColor: hoverBorderColor,
          hoverBackgroundColor: hoverBackgroundColor,
        },
      ],
    });
  }, [props.data, props.labels, props.title]);

	return(
		<>
			<h2>
				{props.title}
			</h2>
			<Pie
				data={data}
			/>
		</>
	);
}

export default PieChart;