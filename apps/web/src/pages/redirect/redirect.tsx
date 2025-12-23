import { type JSX, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppSelector } from "@/app/hooks";
import { PageRoutes } from "@/data/routes";
import { selectReRoute } from "@/features/app/appSlice";
import {
  selectInitialLoaded,
  selectIsAuthenticated,
} from "@/features/auth/authSlice";

export const Redirect = (): JSX.Element => {
  const location = useLocation();
  const navigate = useNavigate();

  const reRoute = useAppSelector(selectReRoute);
  const initialLoad = useAppSelector(selectInitialLoaded);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  useEffect(() => {
    if (reRoute) navigate(reRoute);
  }, [navigate, reRoute]);

  useEffect(() => {
    if (!initialLoad) return;

    const publicRoutes = [
      PageRoutes.login,
      PageRoutes.logout,
      PageRoutes.landing,
      PageRoutes.cover,
    ];

    if (isAuthenticated) {
      if (
        location.pathname === PageRoutes.login ||
        location.pathname === PageRoutes.landing
      ) {
        navigate(PageRoutes.home);
      }
      return;
    }

    if (!publicRoutes.includes(location.pathname)) {
      navigate(PageRoutes.login);
    }
  }, [initialLoad, location, isAuthenticated, navigate]);

  return <></>;
};
