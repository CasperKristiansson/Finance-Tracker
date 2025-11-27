import { all, fork, select } from "redux-saga/effects";
import { AccountsSaga } from "@/features/accounts/accountsSaga";
import { AuthSaga } from "@/features/auth/authSaga";
import { BudgetsSaga } from "@/features/budgets/budgetsSaga";
import { CategoriesSaga } from "@/features/categories/categoriesSaga";
import { ImportsSaga } from "@/features/imports/importsSaga";
import { LoansSaga } from "@/features/loans/loansSaga";
import { ReportsSaga } from "@/features/reports/reportsSaga";
import { TransactionsSaga } from "@/features/transactions/transactionsSaga";
import type { RootState } from "./store";

type Selector<T> = (state: RootState) => T;

export function* TypedSelect<T>(
  selector: Selector<T>,
): Generator<ReturnType<typeof select>, T, T> {
  return yield select(selector);
}

export function* RootSaga() {
  yield all([
    fork(AuthSaga),
    fork(AccountsSaga),
    fork(CategoriesSaga),
    fork(TransactionsSaga),
    fork(ReportsSaga),
    fork(LoansSaga),
    fork(ImportsSaga),
    fork(BudgetsSaga),
  ]);
}
