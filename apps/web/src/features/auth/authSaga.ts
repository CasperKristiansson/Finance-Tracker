import { createAction } from "@reduxjs/toolkit";
import { all, call, put, select, takeLatest } from "redux-saga/effects";
import { toast } from "sonner";
import { resetAccounts } from "@/features/accounts/accountsSlice";
import { resetReports } from "@/features/reports/reportsSlice";
import { resetTransactions } from "@/features/transactions/transactionsSlice";
import { authSessionSchema } from "@/types/schemas";
import { setLoading } from "../app/appSlice";
import authService, { type AuthenticatedUser } from "./authHelpers";
import {
  loginSuccess,
  logoutSuccess,
  selectLastUsername,
  selectIsDemo,
  selectRememberMe,
  setInitialLoaded,
  setLastUsername,
  setLoginError,
  setRememberMe,
} from "./authSlice";

export const AuthLoginGoogle = createAction("auth/loginGoogle");
export const AuthLogout = createAction("auth/logout");
export const AuthInitialize = createAction("auth/initialize");
export const AuthLoginDemo = createAction("auth/loginDemo");

const REMEMBER_KEY = "finance-tracker-remember";
const REMEMBER_USERNAME_KEY = "finance-tracker-last-username";

const persistRememberMe = (remember: boolean, username?: string) => {
  if (remember) {
    localStorage.setItem(REMEMBER_KEY, "1");
    if (username) {
      localStorage.setItem(REMEMBER_USERNAME_KEY, username);
    }
  } else {
    localStorage.removeItem(REMEMBER_KEY);
    localStorage.removeItem(REMEMBER_USERNAME_KEY);
  }
};

const hydrateRemembered = () => {
  if (typeof window === "undefined") return { remember: false, username: "" };
  const remember = localStorage.getItem(REMEMBER_KEY) === "1";
  const username = localStorage.getItem(REMEMBER_USERNAME_KEY) ?? "";
  return { remember, username };
};

function* handleLoginWithGoogle() {
  yield put(setLoading({ key: "login", isLoading: true }));
  yield put(setLoginError(null));
  try {
    yield call(() => authService.signInWithGoogle());
  } catch (error) {
    if (error instanceof Error) {
      yield put(setLoginError(error.message));
      toast.error("Failed to start Google sign-in", {
        description: error.message,
      });
    } else {
      yield put(setLoginError("Failed to start Google sign-in"));
      toast.error("Failed to start Google sign-in");
    }
  }
  yield put(setLoading({ key: "login", isLoading: false }));
}

function* handleLogout() {
  yield put(setLoading({ key: "logout", isLoading: true }));
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    if (!isDemo) {
      yield call(() => authService.signOut());
    }
    yield put(logoutSuccess());
    yield put(resetAccounts());
    yield put(resetTransactions());
    yield put(resetReports());
    toast.success("Logout Successful");
  } catch (error) {
    if (error instanceof Error) {
      toast.error("Failed to Logout", {
        description: error.message,
      });
    } else {
      toast.error("Failed to Logout");
    }
  }
  yield put(setLoading({ key: "logout", isLoading: false }));
}

function* initializeAuth() {
  const { remember, username } = hydrateRemembered();
  yield put(setRememberMe(remember));
  if (username) {
    yield put(setLastUsername(username));
  }
  try {
    yield call(() => authService.completeRedirectIfPresent());
    const existingSession: AuthenticatedUser | null = yield call(() =>
      authService.fetchAuthenticatedUser(),
    );

    if (existingSession) {
      const parsed = authSessionSchema.safeParse(existingSession);
      if (parsed.success) {
        yield put(loginSuccess({ ...parsed.data }));
      } else {
        toast.error("Failed to restore session", {
          description: "Session payload was invalid.",
        });
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      toast.error("Failed to restore session", {
        description: error.message,
      });
    } else {
      toast.error("Failed to restore session");
    }
  }
  yield put(setInitialLoaded());
}

function* handleLoginDemo() {
  yield put(setLoading({ key: "login", isLoading: true }));
  yield put(setLoginError(null));
  const rememberedUsername: string = yield select(selectLastUsername);
  const remember: boolean = yield select(selectRememberMe);
  if (remember) {
    persistRememberMe(true, rememberedUsername || "demo@fintrack.local");
    yield put(setLastUsername(rememberedUsername || "demo@fintrack.local"));
  }
  yield put(
    loginSuccess({
      email: rememberedUsername || "demo@fintrack.local",
      accessToken: "demo-access-token",
      idToken: "demo-id-token",
      refreshToken: "demo-refresh-token",
      isDemo: true,
    }),
  );
  toast.success("Demo mode enabled", {
    description: "You are browsing with demo data.",
  });
  yield put(setLoading({ key: "login", isLoading: false }));
}

export function* AuthSaga() {
  yield all([
    takeLatest(AuthLoginGoogle.type, handleLoginWithGoogle),
    takeLatest(AuthLogout.type, handleLogout),
    takeLatest(AuthInitialize.type, initializeAuth),
    takeLatest(AuthLoginDemo.type, handleLoginDemo),
  ]);
}
