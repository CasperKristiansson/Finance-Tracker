import React from "react";
import { Route, Routes } from "react-router";
import { Cover } from "./pages/cover/cover.tsx";
import { Login } from "./pages/login/login.tsx";
import { NotFound } from "./pages/notFound/notFound.tsx";
import { PageRoutes } from "./data/routes.ts";
import { Home } from "./pages/home/home.tsx";
import { Navigation } from "./pages/navigation/navigation.tsx";

export const App: React.FC = () => {
  return (
    <>
      <Navigation />
      <Routes>
        <Route path={PageRoutes.login} element={<Login />} />
        <Route path={PageRoutes.home} element={<Home />} />
        <Route path={PageRoutes.cover} element={<Cover />} />
        <Route path={PageRoutes.notFound} element={<NotFound />} />
      </Routes>
    </>
  );
};
