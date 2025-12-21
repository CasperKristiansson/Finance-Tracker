import createSagaMiddleware from "@redux-saga/core";
import { configureStore } from "@reduxjs/toolkit";
import { AccountsReducer } from "@/features/accounts/accountsSlice";
import { AppReducer } from "@/features/app/appSlice";
import { AuthReducer } from "@/features/auth/authSlice";
import { BudgetsReducer } from "@/features/budgets/budgetsSlice";
import { CategoriesReducer } from "@/features/categories/categoriesSlice";
import { ImportsReducer } from "@/features/imports/importsSlice";
import { InvestmentsReducer } from "@/features/investments/investmentsSlice";
import { LoansReducer } from "@/features/loans/loansSlice";
import { ReportsReducer } from "@/features/reports/reportsSlice";
import { ReturnsReducer } from "@/features/returns/returnsSlice";
import { SettingsReducer } from "@/features/settings/settingsSlice";
import { TransactionsReducer } from "@/features/transactions/transactionsSlice";
import { WarmupReducer } from "@/features/warmup/warmupSlice";
import { RootSaga } from "./rootSaga";

const sagaMiddleware = createSagaMiddleware();

export const Store = configureStore({
  reducer: {
    auth: AuthReducer,
    app: AppReducer,
    warmup: WarmupReducer,
    accounts: AccountsReducer,
    categories: CategoriesReducer,
    transactions: TransactionsReducer,
    reports: ReportsReducer,
    loans: LoansReducer,
    imports: ImportsReducer,
    investments: InvestmentsReducer,
    budgets: BudgetsReducer,
    settings: SettingsReducer,
    returns: ReturnsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      thunk: false,
    }).concat(sagaMiddleware),
});

sagaMiddleware.run(RootSaga);

export type AppDispatch = typeof Store.dispatch;
export type RootState = ReturnType<typeof Store.getState>;
