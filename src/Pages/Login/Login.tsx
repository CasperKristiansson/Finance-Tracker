import React, { useState } from "react";
import { createUseStyles } from "react-jss";
import { useNavigate } from "react-router-dom";
import { Grid, Segment, Divider, Button, Icon, Header } from "semantic-ui-react";
import { Auth, signInWithEmailAndPassword } from "firebase/auth";

const useStyles = createUseStyles({
	grid: {
		height: "100vh",
	},
	wrapper: {
		marginLeft: -270,
	},
	column: {
		maxWidth: 450,
	},
});

export const Login: React.FC<{ auth: Auth, setUser: any }> = ({ auth, setUser }): JSX.Element => {
	const navigate = useNavigate();
	const classes = useStyles();

	const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

	const handleSubmit = async (e: { preventDefault: () => void; }) => {
    e.preventDefault();

		await signInWithEmailAndPassword(auth, email, password)
		.then((userCredential) => {
			setUser(userCredential.user);
			navigate('/')
		})
		.catch((error) => {
			console.log(error);
		});
  };

  return(
		<>
		<div className={classes.wrapper}>
			<Grid textAlign="center" className={classes.grid} verticalAlign="middle">
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
										onChange={e => setEmail(e.target.value)}
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
										onChange={e => setPassword(e.target.value)}
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
		</>
	);
}
