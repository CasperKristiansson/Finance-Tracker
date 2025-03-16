import { all, call, put, takeLatest } from "redux-saga/effects";
import { createAction } from "@reduxjs/toolkit";
import {
  cognitoLogin,
  cognitoLogout,
  refreshToken,
  type AuthResponse,
  type RefreshTokenResponse,
} from "./authHelpers";
import { TypedSelect } from "@/app/rootSaga";
import { loginSuccess, logoutSuccess, selectToken } from "./authSlice";

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
  } catch {}
}

function* handleLogout() {
  try {
    const accessToken = yield* TypedSelect(selectToken);

    if (accessToken) {
      yield call(cognitoLogout, accessToken);
      yield put(logoutSuccess());
    }
  } catch {}
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
      console.error("Token refresh failed:", error);
    }
  }
}

export function* AuthSaga() {
  yield all([
    takeLatest(AuthLogin.type, handleLogin),
    takeLatest(AuthLogout.type, handleLogout),
    takeLatest(AuthInitialize.type, initializeAuth),
  ]);
}
