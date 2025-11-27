import createSagaMiddleware from "@redux-saga/core";
import { configureStore } from "@reduxjs/toolkit";
import { AccountsReducer } from "@/features/accounts/accountsSlice";
import { AppReducer } from "@/features/app/appSlice";
import { AuthReducer } from "@/features/auth/authSlice";
import { BudgetsReducer } from "@/features/budgets/budgetsSlice";
import { CategoriesReducer } from "@/features/categories/categoriesSlice";
import { ImportsReducer } from "@/features/imports/importsSlice";
import { LoansReducer } from "@/features/loans/loansSlice";
import { ReportsReducer } from "@/features/reports/reportsSlice";
import { TransactionsReducer } from "@/features/transactions/transactionsSlice";
import { RootSaga } from "./rootSaga";

const sagaMiddleware = createSagaMiddleware();

export const Store = configureStore({
  reducer: {
    auth: AuthReducer,
    app: AppReducer,
    accounts: AccountsReducer,
    categories: CategoriesReducer,
    transactions: TransactionsReducer,
    reports: ReportsReducer,
    loans: LoansReducer,
    imports: ImportsReducer,
    budgets: BudgetsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      thunk: false,
    }).concat(sagaMiddleware),
});

sagaMiddleware.run(RootSaga);

export type AppDispatch = typeof Store.dispatch;
export type RootState = ReturnType<typeof Store.getState>;
