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
import type {
  CategoryCreateRequest,
  CategoryListResponse,
  CategoryUpdateRequest,
} from "@/types/api";

export const FetchCategories = createAction<
  Partial<Pick<CategoriesState, "includeArchived">> | undefined
>("categories/fetch");
export const CreateCategory =
  createAction<CategoryCreateRequest>("categories/create");
export const UpdateCategory = createAction<{
  id: string;
  data: CategoryUpdateRequest;
}>("categories/update");

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

function* handleCreateCategory(action: ReturnType<typeof CreateCategory>) {
  try {
    yield call(
      callApiWithAuth,
      {
        path: "/categories",
        method: "POST",
        body: action.payload,
      },
      { loadingKey: "categories" },
    );
    yield call(handleFetchCategories, FetchCategories({}));
  } catch (error) {
    yield put(
      setCategoriesError(
        error instanceof Error ? error.message : "Failed to create category",
      ),
    );
  }
}

function* handleUpdateCategory(action: ReturnType<typeof UpdateCategory>) {
  try {
    yield call(
      callApiWithAuth,
      {
        path: `/categories/${action.payload.id}`,
        method: "PATCH",
        body: action.payload.data,
      },
      { loadingKey: "categories" },
    );
    yield call(handleFetchCategories, FetchCategories({}));
  } catch (error) {
    yield put(
      setCategoriesError(
        error instanceof Error ? error.message : "Failed to update category",
      ),
    );
  }
}

export function* CategoriesSaga() {
  yield takeLatest(FetchCategories.type, handleFetchCategories);
  yield takeLatest(CreateCategory.type, handleCreateCategory);
  yield takeLatest(UpdateCategory.type, handleUpdateCategory);
}
