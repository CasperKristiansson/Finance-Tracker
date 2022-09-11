import React from "react";
import Chart from 'react-apexcharts'


export default (props) => {
  const [data, setData] = React.useState([{}]);

  React.useEffect(() => {
    setData(props.data);
  }, [props.data]);

	var options = {
		chart: {
			height: 350,
			type: 'heatmap',
		},
		colors: ["#008FFB"],
		title: {
			text: 'HeatMap Chart Income'
		},
	};

  return (
    <>
		<div id="chart">
      <h2>{props.title}</h2>
      <Chart series={props.data} type="heatmap" options={options} height={350} />
		</div>
    </>
  );
};
