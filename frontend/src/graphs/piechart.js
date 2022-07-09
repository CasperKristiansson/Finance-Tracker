import { Pie } from 'react-chartjs-2';

export default (props) => {
	return(
		<>
			<h2>
				{props.title}
			</h2>
			<Pie
				data={props.data}
				options={props.options}
				width={"30%"}
				height={"30%"}
			/>
		</>
	);
}