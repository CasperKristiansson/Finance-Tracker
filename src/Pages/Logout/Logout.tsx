import { useEffect } from "react";

export const Logout: React.FC<{ logout: any }> = ({ logout }): JSX.Element => {
	useEffect(() => {
		logout();
	}, []);

	return(
		<>
		</>
	);
};