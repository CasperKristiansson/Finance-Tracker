import React from 'react';
import { Pie } from 'react-chartjs-2';

export interface PieChartStruct {
  labels: string[];
  data: number[];
}

export const PieChart: React.FC<{ data: PieChartStruct, title: string }> = ({ data, title }): JSX.Element => {
    const [dataSet, setDataSet] = React.useState({
    labels: [] as string[],
    datasets: [
      {
        data: [] as number[],
        backgroundColor: [] as string[],
        borderColor: [] as string[],
        hoverBackgroundColor: [] as string[],
        hoverBorderColor: [] as string[],
        borderWidth: 0,
      },
    ],
  });

  React.useEffect(() => {
    setDataSet({
      labels: data.labels,
      datasets: [
        {
          data: data.data,
          backgroundColor: [
            'rgba(54, 162, 235, 0.2)',
            'rgba(255, 99, 132, 0.2)',
            'rgba(255, 206, 86, 0.2)',
            'rgba(75, 192, 192, 0.2)',
            'rgba(153, 102, 255, 0.2)',
            'rgba(255, 159, 64, 0.2)',
          ],
          borderColor: [
            'rgba(54, 162, 235, 1)',
            'rgba(255, 99, 132, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)',
          ],
          hoverBorderColor: [
            'rgba(54, 162, 235, 1)',
            'rgba(255, 99, 132, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)',
          ],
          hoverBackgroundColor: [
            'rgba(54, 162, 235, 1)',
            'rgba(255, 99, 132, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)',
          ],
          borderWidth: 1,
        },
      ],
    });
  }, [data, title]);

	return(
		<>
			<h2>
				{title}
			</h2>
			<Pie
				data={dataSet}
			/>
		</>
	);
}

export default PieChart;