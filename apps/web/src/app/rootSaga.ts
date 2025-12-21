import { all, fork, select } from "redux-saga/effects";
import { AccountsSaga } from "@/features/accounts/accountsSaga";
import { AuthSaga } from "@/features/auth/authSaga";
import { BudgetsSaga } from "@/features/budgets/budgetsSaga";
import { CategoriesSaga } from "@/features/categories/categoriesSaga";
import { ImportsSaga } from "@/features/imports/importsSaga";
import { InvestmentsSaga } from "@/features/investments/investmentsSaga";
import { LoansSaga } from "@/features/loans/loansSaga";
import { ReportsSaga } from "@/features/reports/reportsSaga";
import { ReturnsSaga } from "@/features/returns/returnsSaga";
import { SettingsSaga } from "@/features/settings/settingsSaga";
import { TransactionsSaga } from "@/features/transactions/transactionsSaga";
import { WarmupSaga } from "@/features/warmup/warmupSaga";
import type { RootState } from "./store";

type Selector<T> = (state: RootState) => T;

export function* TypedSelect<T>(
  selector: Selector<T>,
): Generator<ReturnType<typeof select>, T, T> {
  return yield select(selector);
}

export function* RootSaga() {
  yield all([
    fork(WarmupSaga),
    fork(AuthSaga),
    fork(AccountsSaga),
    fork(CategoriesSaga),
    fork(TransactionsSaga),
    fork(ReportsSaga),
    fork(LoansSaga),
    fork(ImportsSaga),
    fork(BudgetsSaga),
    fork(SettingsSaga),
    fork(InvestmentsSaga),
    fork(ReturnsSaga),
  ]);
}
