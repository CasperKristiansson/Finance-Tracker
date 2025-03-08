import React from "react";
import { Route, Routes } from "react-router";
import { Cover } from "./pages/cover/cover";
import { Login } from "./pages/login/login";

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/cover" element={<Cover />} />
      {/* <Route path="*" element={<NotFound />} /> */}
    </Routes>
  );
};
