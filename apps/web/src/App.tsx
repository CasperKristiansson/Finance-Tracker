import React, { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router";
import { useAppDispatch, useAppSelector } from "./app/hooks.ts";
import { AppLoadingShell } from "./components/app-loading-shell.tsx";
import { DatabaseWarmup } from "./components/database-warmup.tsx";
import { Spinner } from "./components/spinner.tsx";
import { PageRoutes } from "./data/routes.ts";
import { selectLoading } from "./features/app/appSlice.tsx";
import { AuthInitialize } from "./features/auth/authSaga.ts";
import {
  selectInitialLoaded,
  selectIsAuthenticated,
  selectIsDemo,
} from "./features/auth/authSlice.ts";
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
import { Loans } from "./pages/loans/loans.tsx";
import { Login } from "./pages/login/login.tsx";
import { Navigation } from "./pages/navigation/navigation.tsx";
import { NotFound } from "./pages/notFound/notFound.tsx";
import { Redirect } from "./pages/redirect/redirect.tsx";
import { Reports } from "./pages/reports/reports.tsx";
import { Settings } from "./pages/settings/settings.tsx";
import { Subscriptions } from "./pages/subscriptions/subscriptions.tsx";
import { Taxes } from "./pages/taxes/taxes.tsx";
import { Transactions } from "./pages/transactions/transactions.tsx";

const NavigationWrapper: React.FC<{
  children: React.ReactNode;
  title: string;
}> = ({ children, title }) => <Navigation title={title}>{children}</Navigation>;

export const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const initialLoaded = useAppSelector(selectInitialLoaded);
  const loadingLogout = useAppSelector(
    (state) => selectLoading(state)["logout"],
  );
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isDemo = useAppSelector(selectIsDemo);
  const warmupState = useAppSelector(selectWarmupState);
  const shouldShowWarmup =
    isAuthenticated && !isDemo && warmupState.status !== "ready";
  const [showDetailedWarmup, setShowDetailedWarmup] = useState(false);

  useEffect(() => {
    dispatch(AuthInitialize());
  }, [dispatch]);

  useEffect(() => {
    if (!isAuthenticated || isDemo) return;
    if (warmupState.status === "idle") {
      dispatch(BeginWarmup());
    }
  }, [dispatch, isAuthenticated, isDemo, warmupState.status]);

  useEffect(() => {
    if (isDemo || warmupState.status !== "ready" || !isAuthenticated) return;
    dispatch(LoadSettings());
  }, [dispatch, isAuthenticated, isDemo, warmupState.status]);

  useEffect(() => {
    if (!shouldShowWarmup) {
      setShowDetailedWarmup(false);
      return;
    }

    if (warmupState.status === "failed") {
      setShowDetailedWarmup(true);
      return;
    }

    setShowDetailedWarmup(false);
    const timer = window.setTimeout(() => setShowDetailedWarmup(true), 5000);
    return () => window.clearTimeout(timer);
  }, [shouldShowWarmup, warmupState.status]);

  if (shouldShowWarmup) {
    if (!showDetailedWarmup) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-white">
          <Spinner color="#2563eb" height={72} width={72} />
        </div>
      );
    }

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
            <Navigate
              to={`${PageRoutes.reportsYearly}/${new Date().getFullYear()}`}
              replace
            />
          }
        />
        <Route
          path={`${PageRoutes.reportsYearly}/:year`}
          element={
            <NavigationWrapper title="Reports">
              <Reports />
            </NavigationWrapper>
          }
        />
        <Route
          path={PageRoutes.reportsTotal}
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
          path={PageRoutes.taxes}
          element={
            <NavigationWrapper title="Taxes">
              <Taxes />
            </NavigationWrapper>
          }
        />
        <Route
          path={PageRoutes.loans}
          element={
            <NavigationWrapper title="Loans">
              <Loans />
            </NavigationWrapper>
          }
        />
        <Route
          path={`${PageRoutes.loans}/:accountId`}
          element={
            <NavigationWrapper title="Loans">
              <Loans />
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
