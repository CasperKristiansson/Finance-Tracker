import { createAction } from "@reduxjs/toolkit";
import { call, put, takeLatest } from "redux-saga/effects";
import { callApiWithAuth } from "@/features/api/apiSaga";
import {
  setBudgets,
  setBudgetsError,
  setBudgetsLoading,
} from "@/features/budgets/budgetsSlice";
import type {
  BudgetCreateRequest,
  BudgetProgressListResponse,
  BudgetUpdateRequest,
} from "@/types/api";

export const FetchBudgets = createAction("budgets/fetch");
export const CreateBudget = createAction<BudgetCreateRequest>("budgets/create");
export const UpdateBudget = createAction<{
  id: string;
  data: BudgetUpdateRequest;
}>("budgets/update");
export const DeleteBudget = createAction<string>("budgets/delete");

function* handleFetchBudgets() {
  yield put(setBudgetsLoading(true));
  try {
    const response: BudgetProgressListResponse = yield call(
      callApiWithAuth,
      { path: "/budgets/progress" },
      { loadingKey: "budgets" },
    );
    yield put(setBudgets(response.budgets));
  } catch (error) {
    yield put(
      setBudgetsError(
        error instanceof Error ? error.message : "Failed to load budgets",
      ),
    );
  } finally {
    yield put(setBudgetsLoading(false));
  }
}

function* handleCreateBudget(action: ReturnType<typeof CreateBudget>) {
  try {
    yield call(
      callApiWithAuth,
      { path: "/budgets", method: "POST", body: action.payload },
      { loadingKey: "budgets" },
    );
    yield call(handleFetchBudgets);
  } catch (error) {
    yield put(
      setBudgetsError(
        error instanceof Error ? error.message : "Failed to create budget",
      ),
    );
  }
}

function* handleUpdateBudget(action: ReturnType<typeof UpdateBudget>) {
  try {
    yield call(
      callApiWithAuth,
      {
        path: `/budgets/${action.payload.id}`,
        method: "PATCH",
        body: action.payload.data,
      },
      { loadingKey: "budgets" },
    );
    yield call(handleFetchBudgets);
  } catch (error) {
    yield put(
      setBudgetsError(
        error instanceof Error ? error.message : "Failed to update budget",
      ),
    );
  }
}

function* handleDeleteBudget(action: ReturnType<typeof DeleteBudget>) {
  try {
    yield call(
      callApiWithAuth,
      { path: `/budgets/${action.payload}`, method: "DELETE" },
      { loadingKey: "budgets" },
    );
    yield call(handleFetchBudgets);
  } catch (error) {
    yield put(
      setBudgetsError(
        error instanceof Error ? error.message : "Failed to delete budget",
      ),
    );
  }
}

export function* BudgetsSaga() {
  yield takeLatest(FetchBudgets.type, handleFetchBudgets);
  yield takeLatest(CreateBudget.type, handleCreateBudget);
  yield takeLatest(UpdateBudget.type, handleUpdateBudget);
  yield takeLatest(DeleteBudget.type, handleDeleteBudget);
}
