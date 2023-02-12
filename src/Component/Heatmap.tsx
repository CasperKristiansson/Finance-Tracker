import React from "react";
import Chart from 'react-apexcharts'

export interface HeatmapStruct {
  name: string;
  data: {
    x: string;
    y: number;
  }[]
}

export interface HeatmapColor {
  from: number;
  to: number;
  color: string;
  name: string;
}

export const Heatmap: React.FC<{ data: HeatmapStruct[], title: string, color: HeatmapColor[] }> = ({ data, title, color }): JSX.Element => {
	var options: any = {
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
          reset: false,
          customIcons: []
        },
			},
		},
		colors: ["#008FFB"],
		plotOptions: {
      heatmap: {
        colorScale: {
          ranges: color
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
      <h2>{title}</h2>
      <Chart type="heatmap" series={data as any} options={options} height={350} />
		</div>
    </>
  );
};
