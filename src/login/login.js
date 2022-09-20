import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Grid, Segment, Divider, Button, Icon, Header } from "semantic-ui-react";

import {
  getAuth,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  updateProfile
} from "firebase/auth";

export default (props) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); 

  let navigate = useNavigate();

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();


		await signInWithEmailAndPassword(props.auth, email, password)
		.then((userCredential) => {
			props.setUser(userCredential.user);
			navigate('/')
		})
		.catch((error) => {
				console.log(error);
		});
  };

  return (
    <>
			<div className={"login-section"}>
				<div className={"login-section-content"}>
					{/* Create a login section using semantic components */}
					<Grid textAlign="center" style={{ height: "100vh" }} verticalAlign="middle">
						<Grid.Column style={{ maxWidth: 450 }}>
							<Header as="h2" color="teal" textAlign="center">
								<Icon name="user" /> Log-in to your account
							</Header>
							<form className="ui large form" onSubmit={handleSubmit}>
								<Segment stacked>
									<div className="field">
										<div className="ui left icon input">
											<i className="user icon"></i>
											<input
												type="text"
												name="email"
												placeholder="E-mail address"
												value={email}
												onChange={handleEmailChange}
											/>
										</div>
									</div>
									<div className="field">
										<div className="ui left icon input">
											<i className="lock icon"></i>
											<input
												type="password"
												name="password"
												placeholder="Password"
												value={password}
												onChange={handlePasswordChange}
											/>
										</div>
									</div>
									<Button color="teal" fluid size="large">
										Login
									</Button>
								</Segment>
							</form>
							<Divider horizontal>Or</Divider>
							<Button color="teal" fluid size="large">
								Sign Up
							</Button>
						</Grid.Column>
					</Grid>
				</div>
			</div>
		</>
  );
};