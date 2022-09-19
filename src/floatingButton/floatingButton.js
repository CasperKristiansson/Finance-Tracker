import React, {useEffect, useState} from "react";
import { Button, Icon, Popup } from "semantic-ui-react";
import { useNavigate } from "react-router-dom";
import './floatingButton.css';

export default (props) => {	

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

