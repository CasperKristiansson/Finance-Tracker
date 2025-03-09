import React from "react";
import { Route, Routes } from "react-router";
import { Cover } from "./pages/cover/cover.tsx";
import { Login } from "./pages/login/login.tsx";
import { NotFound } from "./pages/notFound/notFound.tsx";
import { PageRoutes } from "./data/routes.ts";
import { Navigation } from "./pages/navigation/navigation.tsx";
import { Dashboard } from "./pages/dashboard/dashboard.tsx";
import { Accounts } from "./pages/accounts/accounts.tsx";

export const App: React.FC = () => {
  const NavigationWrapper = ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title: string;
  }) => {
    return <Navigation title={title}>{children}</Navigation>;
  };

  return (
    <Routes>
      <Route path={PageRoutes.login} element={<Login />} />
      <Route path={PageRoutes.cover} element={<Cover />} />
      <Route path={PageRoutes.notFound} element={<NotFound />} />

      <Route
        path={PageRoutes.home}
        element={
          <NavigationWrapper title="Dashboard">
            <Dashboard />
          </NavigationWrapper>
        }
      />
      <Route
        path={PageRoutes.accounts}
        element={
          <NavigationWrapper title="Accounts">
            <Accounts />
          </NavigationWrapper>
        }
      />
    </Routes>
  );
};
