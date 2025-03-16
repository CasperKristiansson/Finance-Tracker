import { createAction } from "@reduxjs/toolkit";
import { all, call, put, takeLatest } from "redux-saga/effects";
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
    } catch {}
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
