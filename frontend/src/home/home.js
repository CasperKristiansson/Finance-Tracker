import React from "react";
import "./home.css";
import { Grid, Segment, Button } from "semantic-ui-react";
import PieChart from "../graphs/piechart";

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
								<Grid.Row stretched>
									<Grid.Column>
										<Segment>1</Segment>
									</Grid.Column>
									<Grid.Column>
										<Segment>2</Segment>
									</Grid.Column>
								</Grid.Row>
								<Grid.Row stretched>
									<Grid.Column>
										<Segment>3</Segment>
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
												labels: ["Food", "Transport", "Entertainment", "Other"],
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