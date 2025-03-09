import { RoutesNoNavigation } from "@/data/routes";
import React from "react";
import { useLocation } from "react-router";

export const Navigation: React.FC = () => {
  const location = useLocation();

  if (RoutesNoNavigation.includes(location.pathname)) {
    return <></>;
  }

  return <></>;
};
