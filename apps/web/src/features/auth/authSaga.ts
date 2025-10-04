import { createAction } from "@reduxjs/toolkit";
import { all, call, put, takeLatest } from "redux-saga/effects";
import { toast } from "sonner";
import { setLoading } from "../app/appSlice";
import authService, { type AuthenticatedUser } from "./authHelpers";
import { loginSuccess, logoutSuccess, setInitialLoaded } from "./authSlice";

export const AuthLogin = createAction<{ username: string; password: string }>(
  "auth/login",
);
export const AuthLogout = createAction("auth/logout");
export const AuthInitialize = createAction("auth/initialize");

function* handleLogin(action: ReturnType<typeof AuthLogin>) {
  yield put(setLoading({ key: "login", isLoading: true }));
  try {
    const session: AuthenticatedUser = yield call(() =>
      authService.signIn(action.payload.username, action.payload.password),
    );
    yield put(loginSuccess(session));
    toast.success("Login Successful");
  } catch (error) {
    if (error instanceof Error) {
      toast.error("Failed to Login", {
        description: error.message,
      });
    } else {
      toast.error("Failed to Login");
    }
  }
  yield put(setLoading({ key: "login", isLoading: false }));
}

function* handleLogout() {
  yield put(setLoading({ key: "logout", isLoading: true }));
  try {
    yield call(() => authService.signOut());
    yield put(logoutSuccess());
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
  try {
    const existingSession: AuthenticatedUser | null = yield call(() =>
      authService.fetchAuthenticatedUser(),
    );

    if (existingSession) {
      yield put(loginSuccess(existingSession));
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

export function* AuthSaga() {
  yield all([
    takeLatest(AuthLogin.type, handleLogin),
    takeLatest(AuthLogout.type, handleLogout),
    takeLatest(AuthInitialize.type, initializeAuth),
  ]);
}
