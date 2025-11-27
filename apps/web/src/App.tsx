import React, { useEffect } from "react";
import { Route, Routes } from "react-router";
import { useAppDispatch, useAppSelector } from "./app/hooks.ts";
import { AppLoadingShell } from "./components/app-loading-shell.tsx";
import { PageRoutes } from "./data/routes.ts";
import { selectLoading } from "./features/app/appSlice.tsx";
import { AuthInitialize } from "./features/auth/authSaga.ts";
import { selectInitialLoaded } from "./features/auth/authSlice.ts";
import { Accounts } from "./pages/accounts/accounts.tsx";
import { Budgets } from "./pages/budgets/budgets.tsx";
import { Categories } from "./pages/categories/categories.tsx";
import { Cover } from "./pages/cover/cover.tsx";
import { Dashboard } from "./pages/dashboard/dashboard.tsx";
import { Imports } from "./pages/imports/imports.tsx";
import { Login } from "./pages/login/login.tsx";
import { Navigation } from "./pages/navigation/navigation.tsx";
import { NotFound } from "./pages/notFound/notFound.tsx";
import { Redirect } from "./pages/redirect/redirect.tsx";
import { Reports } from "./pages/reports/reports.tsx";
import { Transactions } from "./pages/transactions/transactions.tsx";

export const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const initialLoaded = useAppSelector(selectInitialLoaded);
  const loadingLogout = useAppSelector(selectLoading)["logout"];

  const NavigationWrapper = ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title: string;
  }) => {
    return <Navigation title={title}>{children}</Navigation>;
  };

  useEffect(() => {
    dispatch(AuthInitialize());
  }, [dispatch]);

  if (!initialLoaded || loadingLogout) {
    return <AppLoadingShell />;
  }

  return (
    <>
      <Redirect />
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
        <Route
          path={PageRoutes.categories}
          element={
            <NavigationWrapper title="Categories">
              <Categories />
            </NavigationWrapper>
          }
        />
        <Route
          path={PageRoutes.budgets}
          element={
            <NavigationWrapper title="Budgets">
              <Budgets />
            </NavigationWrapper>
          }
        />
        <Route
          path={PageRoutes.transactions}
          element={
            <NavigationWrapper title="Transactions">
              <Transactions />
            </NavigationWrapper>
          }
        />
        <Route
          path={PageRoutes.imports}
          element={
            <NavigationWrapper title="Imports">
              <Imports />
            </NavigationWrapper>
          }
        />
        <Route
          path={PageRoutes.reports}
          element={
            <NavigationWrapper title="Reports">
              <Reports />
            </NavigationWrapper>
          }
        />
      </Routes>
    </>
  );
};
