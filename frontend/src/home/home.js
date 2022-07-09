import React from "react";
import "./home.css";
import { Grid, Segment, Button } from "semantic-ui-react";
import PieChart from "../graphs/piechart";
import BarChart from "../graphs/barchart";

export default () => {
	return (
		<>
		<div className={"main-section"}>
			<h1>Monthly Overview</h1>
			<div className={"main-section-content"}>
				<Grid columns={2}>
					<Grid.Row stretched>
						<Grid.Column>
							<Grid columns={"equal"}>
								<Grid.Row>
									<Grid.Column>
										<Button
											icon="plus"
											content="Add Transaction"
											color="green"
											className={"main-section-button"}
										/>
									</Grid.Column>
									<Grid.Column>
										<Button
											icon="file"
											content="Import Excel"
											color="blue"
											className={"main-section-button"}
										/>
									</Grid.Column>
								</Grid.Row>
							</Grid>
							<Grid className={"grid-max-height"}>
								<Grid.Row stretched>
									<Grid.Column>
										<Segment>
											<BarChart
												title="2022"
												data={{
													labels: [
														"January",
														"February",
														"March",
														"April",
														"May",
														"June",
														"July",
														"August",
														"September",
														"October",
														"November",
														"December"
													],
													datasets: [
														{
															label: "Income",
															backgroundColor: "rgba(255,99,132,0.2)",
															borderColor: "rgba(255,99,132,1)",
															borderWidth: 1,
															hoverBackgroundColor: "rgba(255,99,132,0.4)",
															hoverBorderColor: "rgba(255,99,132,1)",
															data: [65, 59, 80, 81, 56, 55, 40, 80, 81, 56, 55, 40]
														},
														{
															label: "Expenses",
															backgroundColor: "rgba(54,162,235,0.2)",
															borderColor: "rgba(54,162,235,1)",
															borderWidth: 1,
															hoverBackgroundColor: "rgba(54,162,235,0.4)",
															hoverBorderColor: "rgba(54,162,235,1)",
															data: [65, 59, 80, 81, 56, 55, 40, 80, 81, 56, 55, 40]
														}
													]
												}}

												options={{
													title: {
														display: true,
														text: "Income and Expenses",
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
												}}
											/>
										</Segment>
									</Grid.Column>
								</Grid.Row>
							</Grid>
						</Grid.Column>
						<Grid.Column>
								<Segment>
									<Button.Group>
										<Button color="red">Expenses</Button>
										<Button.Or />
										<Button positive>Income</Button>
									</Button.Group>
									<div className={"main-section-pie"}>
										<PieChart 
											title="Expenses"
											data={{
												labels: ["Food (25%)", "Transport", "Entertainment", "Other"],
												datasets: [
													{
														label: "Expenses",
														data: [12, 19, 3, 5],
														backgroundColor: [
															'rgba(255, 99, 132, 0.2)',
															'rgba(54, 162, 235, 0.2)',
															'rgba(255, 206, 86, 0.2)',
															'rgba(75, 192, 192, 0.2)',
															'rgba(153, 102, 255, 0.2)',
															'rgba(255, 159, 64, 0.2)',
														],
														borderColor: [
															'rgba(255, 99, 132, 1)',
															'rgba(54, 162, 235, 1)',
															'rgba(255, 206, 86, 1)',
															'rgba(75, 192, 192, 1)',
															'rgba(153, 102, 255, 1)',
															'rgba(255, 159, 64, 1)',
														],
														borderWidth: 1,
													}
												]
											}}
											options={{
												
											}}		
										/>
									</div>
								</Segment>
						</Grid.Column>
					</Grid.Row>
				</Grid>
				<Segment>
					<Grid columns={"equal"}>
						<Grid.Row stretched>
							<Grid.Column>
								<Segment>1</Segment>
							</Grid.Column>
							<Grid.Column>
								<Segment>2</Segment>
							</Grid.Column>
						</Grid.Row>
					</Grid>
				</Segment>
			</div>
		</div>
		</>
	);
}