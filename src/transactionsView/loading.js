import React from "react";
import { usePromiseTracker } from "react-promise-tracker";
import { Loader } from 'semantic-ui-react'
 
function Loading(props) {
  const { promiseInProgress } = usePromiseTracker();

  return (
    promiseInProgress && 
    <Loader active size='big'/>
  );  
}

export default Loading;