import React, { useEffect } from "react";

const Logout = (props) => {
  useEffect(() => {
		props.signOut();
	}, [props]);

  return (
    <>
		</>
  );
};

export default Logout;