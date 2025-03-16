import createSagaMiddleware from "@redux-saga/core";
import { configureStore } from "@reduxjs/toolkit";
import { AppReducer } from "@/features/app/appSlice";
import { AuthReducer } from "@/features/auth/authSlice";
import { RootSaga } from "./rootSaga";

const sagaMiddleware = createSagaMiddleware();

export const Store = configureStore({
  reducer: {
    auth: AuthReducer,
    app: AppReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      thunk: false,
    }).concat(sagaMiddleware),
});

sagaMiddleware.run(RootSaga);

export type AppDispatch = typeof Store.dispatch;
export type RootState = ReturnType<typeof Store.getState>;
