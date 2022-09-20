import React, { useEffect } from "react";

export default (props) => {
  useEffect(() => {
		props.signOut();
	}, []);

  return (
    <>
		</>
  );
};