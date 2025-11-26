import { createAction } from "@reduxjs/toolkit";
import { call, put, takeLatest } from "redux-saga/effects";
import { callApiWithAuth } from "@/features/api/apiSaga";
import {
  setCategories,
  setCategoriesError,
  setCategoriesFilters,
  setCategoriesLoading,
  type CategoriesState,
} from "@/features/categories/categoriesSlice";
import type { CategoryListResponse } from "@/types/api";

export const FetchCategories = createAction<
  Partial<Pick<CategoriesState, "includeArchived">> | undefined
>("categories/fetch");

function* handleFetchCategories(action: ReturnType<typeof FetchCategories>) {
  const filters = action.payload ?? {};
  yield put(setCategoriesLoading(true));
  if (action.payload) {
    yield put(setCategoriesFilters(action.payload));
  }

  try {
    const query = {
      include_archived: filters.includeArchived ?? false,
    };

    const response: CategoryListResponse = yield call(
      callApiWithAuth,
      { path: "/categories", query },
      { loadingKey: "categories" },
    );

    yield put(setCategories(response.categories));
  } catch (error) {
    yield put(
      setCategoriesError(
        error instanceof Error ? error.message : "Failed to load categories",
      ),
    );
  } finally {
    yield put(setCategoriesLoading(false));
  }
}

export function* CategoriesSaga() {
  yield takeLatest(FetchCategories.type, handleFetchCategories);
}
