import React from 'react';
import { Bar } from 'react-chartjs-2';

export default (props) => {
	return(
		<>
			<h2>
				{props.title}
			</h2>
			<Bar
				data={props.data}
				options={props.options}
			/>
		</>
	);
}