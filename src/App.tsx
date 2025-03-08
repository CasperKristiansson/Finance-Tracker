import React from "react";
import { Route, Routes } from "react-router";
import { Login } from "./pages/login/login";

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      {/* <Route path="*" element={<NotFound />} /> */}
    </Routes>
  );
};
