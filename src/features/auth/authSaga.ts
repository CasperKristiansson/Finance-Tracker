import { all, call, takeLatest } from "redux-saga/effects";
import { createAction } from "@reduxjs/toolkit";
import { cognitoLogin, type AuthResponse } from "./authHelpers";

export const AuthLogin = createAction<{ username: string; password: string }>(
  "auth/login",
);

function* handleLogin(action: ReturnType<typeof AuthLogin>) {
  try {
    const tokens: AuthResponse = yield call(
      cognitoLogin,
      action.payload.username,
      action.payload.password,
    );
    console.log(tokens);
  } catch {}
}

export function* AuthSaga() {
  yield all([takeLatest(AuthLogin.type, handleLogin)]);
}
