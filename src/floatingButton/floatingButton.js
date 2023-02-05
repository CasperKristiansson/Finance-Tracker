import React from "react";
import { Button, Icon, Popup } from "semantic-ui-react";
import { useNavigate } from "react-router-dom";
import './floatingButton.css';

const FloatingButton = () => {	

	var navigate = useNavigate();
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
						className="floatingButton"
					>
						<Icon name="plus" />
					</Button>
				}
			/>
		</>
	);
};

export default FloatingButton;