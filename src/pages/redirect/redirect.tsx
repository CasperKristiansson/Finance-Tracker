import { type JSX, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppSelector } from "@/app/hooks";
import { PageRoutes } from "@/data/routes";
import { selectReRoute } from "@/features/app/appSlice";
import {
  selectInitialLoaded,
  selectIsAuthenticated,
} from "@/features/auth/authSlice";

export const Base = (): JSX.Element => {
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

    if (isAuthenticated && location.pathname === PageRoutes.login) {
      navigate(PageRoutes.home);
    } else if (!isAuthenticated && location.pathname !== PageRoutes.login) {
      navigate(PageRoutes.login);
    }
  }, [initialLoad, location, isAuthenticated, navigate]);

  return <></>;
};
