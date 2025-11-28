import React, { useEffect } from "react";
import { Route, Routes } from "react-router";
import { useAppDispatch, useAppSelector } from "./app/hooks.ts";
import { AppLoadingShell } from "./components/app-loading-shell.tsx";
import { DatabaseWarmup } from "./components/database-warmup.tsx";
import { PageRoutes } from "./data/routes.ts";
import { selectLoading } from "./features/app/appSlice.tsx";
import { AuthInitialize } from "./features/auth/authSaga.ts";
import { selectInitialLoaded } from "./features/auth/authSlice.ts";
import { LoadSettings } from "./features/settings/settingsSaga.ts";
import { BeginWarmup } from "./features/warmup/warmupSaga.ts";
import { selectWarmupState } from "./features/warmup/warmupSlice.ts";
import { Accounts } from "./pages/accounts/accounts.tsx";
import { Budgets } from "./pages/budgets/budgets.tsx";
import { CashFlow } from "./pages/cash-flow/cash-flow.tsx";
import { Categories } from "./pages/categories/categories.tsx";
import { Cover } from "./pages/cover/cover.tsx";
import { Dashboard } from "./pages/dashboard/dashboard.tsx";
import { Goals } from "./pages/goals/goals.tsx";
import { Imports } from "./pages/imports/imports.tsx";
import { Investments } from "./pages/investments/investments.tsx";
import { Login } from "./pages/login/login.tsx";
import { Navigation } from "./pages/navigation/navigation.tsx";
import { NotFound } from "./pages/notFound/notFound.tsx";
import { Redirect } from "./pages/redirect/redirect.tsx";
import { Reports } from "./pages/reports/reports.tsx";
import { Settings } from "./pages/settings/settings.tsx";
import { Transactions } from "./pages/transactions/transactions.tsx";
import { Subscriptions } from "./pages/subscriptions/subscriptions.tsx";

export const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const initialLoaded = useAppSelector(selectInitialLoaded);
  const loadingLogout = useAppSelector(selectLoading)["logout"];
  const warmupState = useAppSelector(selectWarmupState);

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
    dispatch(BeginWarmup());
  }, [dispatch]);

  useEffect(() => {
    if (warmupState.status === "ready") {
      dispatch(AuthInitialize());
      dispatch(LoadSettings());
    }
  }, [dispatch, warmupState.status]);

  if (warmupState.status !== "ready") {
    return (
      <DatabaseWarmup
        warmupState={warmupState}
        onRetry={() => dispatch(BeginWarmup())}
      />
    );
  }

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
          path={PageRoutes.subscriptions}
          element={
            <NavigationWrapper title="Subscriptions">
              <Subscriptions />
            </NavigationWrapper>
          }
        />
        <Route
          path={PageRoutes.investments}
          element={
            <NavigationWrapper title="Investments">
              <Investments />
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
        <Route
          path={PageRoutes.cashFlow}
          element={
            <NavigationWrapper title="Cash Flow">
              <CashFlow />
            </NavigationWrapper>
          }
        />
        <Route
          path={PageRoutes.goals}
          element={
            <NavigationWrapper title="Goals">
              <Goals />
            </NavigationWrapper>
          }
        />
        <Route
          path={PageRoutes.settings}
          element={
            <NavigationWrapper title="Settings">
              <Settings />
            </NavigationWrapper>
          }
        />
      </Routes>
    </>
  );
};
