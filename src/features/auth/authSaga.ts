import { createAction } from "@reduxjs/toolkit";
import { all, call, put, takeLatest } from "redux-saga/effects";
import { toast } from "sonner";
import { TypedSelect } from "@/app/rootSaga";
import {
  cognitoLogin,
  cognitoLogout,
  refreshToken,
  type AuthResponse,
  type RefreshTokenResponse,
} from "./authHelpers";
import {
  loginSuccess,
  logoutSuccess,
  selectToken,
  setInitialLoaded,
} from "./authSlice";

export const AuthLogin = createAction<{ username: string; password: string }>(
  "auth/login",
);
export const AuthLogout = createAction("auth/logout");
export const AuthInitialize = createAction("auth/initialize");

function* handleLogin(action: ReturnType<typeof AuthLogin>) {
  try {
    const tokens: AuthResponse = yield call(
      cognitoLogin,
      action.payload.username,
      action.payload.password,
    );
    yield put(loginSuccess({ email: action.payload.username, ...tokens }));
  } catch (error) {
    if (error instanceof Error) {
      toast("Failed to Login", {
        description: error.message,
      });
    } else {
      toast("Failed to Login");
    }
  }
}

function* handleLogout() {
  try {
    const accessToken = yield* TypedSelect(selectToken);

    if (accessToken) {
      yield call(cognitoLogout, accessToken);
      yield put(logoutSuccess());
    }
  } catch (error) {
    if (error instanceof Error) {
      toast("Failed to Logout", {
        description: error.message,
      });
    } else {
      toast("Failed to Logout");
    }
  }
}

function* initializeAuth() {
  const storedRefreshToken = localStorage.getItem("refreshToken");
  const storedEmail = localStorage.getItem("email");

  if (storedRefreshToken && storedEmail) {
    try {
      const tokens: RefreshTokenResponse = yield call(
        refreshToken,
        storedRefreshToken,
      );
      yield put(
        loginSuccess({
          ...tokens,
          refreshToken: storedRefreshToken,
          email: storedEmail,
        }),
      );
    } catch (error) {
      if (error instanceof Error) {
        toast("Failed to Refresh Token", {
          description: error.message,
        });
      } else {
        toast("Failed to Refresh Token");
      }
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
