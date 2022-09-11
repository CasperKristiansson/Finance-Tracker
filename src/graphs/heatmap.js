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
			toolbar: {
        show: true,
        offsetX: 0,
        offsetY: 0,
        tools: {
          download: true,
          selection: false,
          zoom: false,
          zoomin: false,
          zoomout: false,
          pan: false,
          reset: false | '<img src="/static/icons/reset.png" width="20">',
          customIcons: []
        },
			},
		},
		colors: ["#008FFB"],
		plotOptions: {
      heatmap: {
        colorScale: {
          ranges: props.color
      	}
    	}
		},
		toolbar: {
			show: false,
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
