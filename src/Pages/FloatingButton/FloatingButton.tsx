
import React from "react";
import { createUseStyles } from "react-jss";
import { useNavigate } from "react-router-dom";
import { Button, Icon, Popup } from "semantic-ui-react";

const useStyles = createUseStyles({
	floatingButton: {
		position: "fixed",
		bottom: 25,
		right: 25,
		borderRadius: "50% !important",
		zIndex: 9999999,
	},
});

export const FloatingButton: React.FC<{}> = (): JSX.Element => {
	const classes = useStyles();
  const navigate = useNavigate();

	return(
		<>
		<Popup
				content='Add a new transaction'
				trigger={
					<Button
						icon
						floated="right"
						size="massive"
						color="green"
						onClick={() =>navigate(`/addTransaction`)}
						className={classes.floatingButton}
					>
						<Icon name="plus" />
					</Button>
				}
		/>
		</>
	);
};