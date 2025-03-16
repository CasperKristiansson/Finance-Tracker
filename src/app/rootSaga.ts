import { all, fork, select } from "redux-saga/effects";
import type { RootState } from "./store";
import { AuthSaga } from "@/features/auth/authSaga";

type Selector<T> = (state: RootState) => T;

export function* TypedSelect<T>(
  selector: Selector<T>,
): Generator<ReturnType<typeof select>, T, T> {
  return yield select(selector);
}

export function* RootSaga() {
  yield all([fork(AuthSaga)]);
}
