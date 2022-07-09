import React from "react";
import "./home.css";
import { Grid, Segment } from "semantic-ui-react";

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
								<Segment>1</Segment>
						</Grid.Column>
					</Grid.Row>
				</Grid>
			</div>
		</div>
		</>
	);
}