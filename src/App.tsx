import React, { useEffect } from "react";
import { Route, Routes } from "react-router";
import { useAppDispatch, useAppSelector } from "./app/hooks.ts";
import { Spinner } from "./components/spinner.tsx";
import { PageRoutes } from "./data/routes.ts";
import { AuthInitialize } from "./features/auth/authSaga.ts";
import { selectInitialLoaded } from "./features/auth/authSlice.ts";
import { Accounts } from "./pages/accounts/accounts.tsx";
import { Cover } from "./pages/cover/cover.tsx";
import { Dashboard } from "./pages/dashboard/dashboard.tsx";
import { Login } from "./pages/login/login.tsx";
import { Navigation } from "./pages/navigation/navigation.tsx";
import { NotFound } from "./pages/notFound/notFound.tsx";
import { Redirect } from "./pages/redirect/redirect.tsx";

export const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const initialLoaded = useAppSelector(selectInitialLoaded);

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

  if (!initialLoaded) {
    return (
      <div
        className={
          "fixed inset-0 z-50 flex items-center justify-center opacity-80 transition-opacity duration-200 ease-in-out"
        }
      >
        <Spinner height={100} width={100} />
      </div>
    );
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
      </Routes>
    </>
  );
};
