import createSagaMiddleware from "@redux-saga/core";
import { configureStore } from "@reduxjs/toolkit";
import { RootSaga } from "./rootSaga";
import { AuthReducer } from "@/features/auth/authSlice";

const sagaMiddleware = createSagaMiddleware();

export const Store = configureStore({
  reducer: {
    auth: AuthReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      thunk: false,
      // eslint-disable-next-line unicorn/prefer-spread
    }).concat(sagaMiddleware),
});

sagaMiddleware.run(RootSaga);

export type AppDispatch = typeof Store.dispatch;
export type RootState = ReturnType<typeof Store.getState>;
