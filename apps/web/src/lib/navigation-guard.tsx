import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";

type NavigationBlocker = (to: string) => boolean;

type NavigationGuardContextValue = {
  canNavigate: (to: string) => boolean;
  setNavigationBlocker: (blocker: NavigationBlocker | null) => void;
};

const NavigationGuardContext =
  createContext<NavigationGuardContextValue | null>(null);

export const NavigationGuardProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const blockerRef = useRef<NavigationBlocker | null>(null);

  const setNavigationBlocker = useCallback(
    (blocker: NavigationBlocker | null) => {
      blockerRef.current = blocker;
    },
    [],
  );

  const canNavigate = useCallback((to: string) => {
    const blocker = blockerRef.current;
    if (!blocker) return true;
    return blocker(to);
  }, []);

  const value = useMemo(
    () => ({ canNavigate, setNavigationBlocker }),
    [canNavigate, setNavigationBlocker],
  );

  return (
    <NavigationGuardContext.Provider value={value}>
      {children}
    </NavigationGuardContext.Provider>
  );
};

export const useNavigationGuard = () => {
  const context = useContext(NavigationGuardContext);
  if (!context) {
    throw new Error(
      "useNavigationGuard must be used within a NavigationGuardProvider",
    );
  }
  return context;
};
