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
												dataIncome={[65, 59, 80, 81, 56, 55, 40, 80, 81, 56, 55, 40]}
												dataExpense={[65, 59, 80, 81, 56, 55, 40, 80, 81, 56, 55, 40]}												
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
											labels={["Food (25%)", "Transport", "Entertainment", "Other"]}
											data={[12, 19, 3, 5]}
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