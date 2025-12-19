import { createAction } from "@reduxjs/toolkit";
import { call, put, select, takeLatest } from "redux-saga/effects";
import { demoBudgets } from "@/data/demoPayloads";
import { callApiWithAuth } from "@/features/api/apiSaga";
import { selectIsDemo } from "@/features/auth/authSlice";
import {
  selectBudgets,
  setBudgets,
  setBudgetsError,
  setBudgetsLoading,
} from "@/features/budgets/budgetsSlice";
import type {
  BudgetCreateRequest,
  BudgetProgressListResponse,
  BudgetUpdateRequest,
} from "@/types/api";
import {
  budgetCreateRequestSchema,
  budgetProgressListSchema,
  budgetUpdateRequestSchema,
} from "@/types/schemas";

export const FetchBudgets = createAction("budgets/fetch");
export const CreateBudget = createAction<BudgetCreateRequest>("budgets/create");
export const UpdateBudget = createAction<{
  id: string;
  data: BudgetUpdateRequest;
}>("budgets/update");
export const DeleteBudget = createAction<string>("budgets/delete");

function* handleFetchBudgets() {
  yield put(setBudgetsLoading(true));
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    if (isDemo) {
      yield put(setBudgets(demoBudgets.budgets));
    } else {
      const response: BudgetProgressListResponse = yield call(
        callApiWithAuth,
        { path: "/budgets/progress", schema: budgetProgressListSchema },
        { loadingKey: "budgets" },
      );
      yield put(setBudgets(response.budgets));
    }
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
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    const body = budgetCreateRequestSchema.parse(action.payload);
    if (isDemo) {
      const current = (yield select(
        selectBudgets,
      )) as BudgetProgressListResponse["budgets"];
      yield put(
        setBudgets([
          ...current,
          {
            id: `demo-budget-${Date.now()}`,
            category_id: body.category_id,
            period: body.period,
            amount: body.amount,
            note: body.note ?? null,
            spent: "0",
            remaining: body.amount,
            percent_used: "0",
          },
        ]),
      );
      return;
    }

    yield call(
      callApiWithAuth,
      { path: "/budgets", method: "POST", body },
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
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    const body = budgetUpdateRequestSchema.parse(action.payload.data);
    if (isDemo) {
      const current = (yield select(
        selectBudgets,
      )) as BudgetProgressListResponse["budgets"];
      yield put(
        setBudgets(
          current.map((budget) =>
            budget.id === action.payload.id
              ? {
                  ...budget,
                  ...body,
                  note: body.note ?? budget.note,
                }
              : budget,
          ),
        ),
      );
      return;
    }

    yield call(
      callApiWithAuth,
      {
        path: `/budgets/${action.payload.id}`,
        method: "PATCH",
        body,
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
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    if (isDemo) {
      yield put(
        setBudgets(
          (
            (yield select(
              selectBudgets,
            )) as BudgetProgressListResponse["budgets"]
          ).filter((budget) => budget.id !== action.payload),
        ),
      );
      return;
    }

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
