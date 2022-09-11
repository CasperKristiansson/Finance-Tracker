import React from "react";
import Chart from 'react-apexcharts'


export default (props) => {
  const [data, setData] = React.useState({xLabels: [], data: [[]]});

  React.useEffect(() => {
    setData(props.data);
  }, [props.data]);

	var options = {
		chart: {
			height: 350,
			type: 'heatmap',
		},
		dataLabels: {
			enabled: false
		},
		colors: ["#008FFB"],
		title: {
			text: 'HeatMap Chart (Single color)'
		},
	};

  return (
    <>
		<div id="chart">
      <h2>{props.title}</h2>
      <Chart series={[{name: "e", data: ([1,2,3])}]} type="heatmap" options={options} height={350} />
		</div>
    </>
  );
};
