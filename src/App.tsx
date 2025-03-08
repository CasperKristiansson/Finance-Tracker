import React from "react";
import { Route, Routes } from "react-router";
import { Navigation } from "./components/navigation/navigation";
import { Cover } from "./pages/cover/cover";
import { Login } from "./pages/login/login";
import { NotFound } from "./pages/notFound/notFound";

export const App: React.FC = () => {
  return (
    <>
      <Navigation />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/cover" element={<Cover />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};
