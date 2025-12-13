import { createAction } from "@reduxjs/toolkit";
import { call, put, select, takeLatest } from "redux-saga/effects";
import { callApiWithAuth } from "@/features/api/apiSaga";
import {
  selectCategoriesState,
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
import {
  categoryCreateRequestSchema,
  categoryListSchema,
  categoryUpdateRequestSchema,
} from "@/types/schemas";

export const FetchCategories = createAction<
  Partial<Pick<CategoriesState, "includeArchived">> | undefined
>("categories/fetch");
export const CreateCategory =
  createAction<CategoryCreateRequest>("categories/create");
export const UpdateCategory = createAction<{
  id: string;
  data: CategoryUpdateRequest;
}>("categories/update");
export const MergeCategory = createAction<{
  sourceCategoryId: string;
  targetCategoryId: string;
  renameTargetTo?: string;
}>("categories/merge");

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
      { path: "/categories", query, schema: categoryListSchema },
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
    const body = categoryCreateRequestSchema.parse(action.payload);
    yield call(
      callApiWithAuth,
      {
        path: "/categories",
        method: "POST",
        body,
      },
      { loadingKey: "categories" },
    );
    const state: CategoriesState = yield select(selectCategoriesState);
    yield call(
      handleFetchCategories,
      FetchCategories({ includeArchived: state.includeArchived }),
    );
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
    const body = categoryUpdateRequestSchema.parse(action.payload.data);
    yield call(
      callApiWithAuth,
      {
        path: `/categories/${action.payload.id}`,
        method: "PATCH",
        body,
      },
      { loadingKey: "categories" },
    );
    const state: CategoriesState = yield select(selectCategoriesState);
    yield call(
      handleFetchCategories,
      FetchCategories({ includeArchived: state.includeArchived }),
    );
  } catch (error) {
    yield put(
      setCategoriesError(
        error instanceof Error ? error.message : "Failed to update category",
      ),
    );
  }
}

function* handleMergeCategory(action: ReturnType<typeof MergeCategory>) {
  try {
    yield call(
      callApiWithAuth,
      {
        path: "/categories/merge",
        method: "POST",
        body: {
          source_category_id: action.payload.sourceCategoryId,
          target_category_id: action.payload.targetCategoryId,
          rename_target_to: action.payload.renameTargetTo,
        },
      },
      { loadingKey: "categories" },
    );
    const state: CategoriesState = yield select(selectCategoriesState);
    yield call(
      handleFetchCategories,
      FetchCategories({ includeArchived: state.includeArchived }),
    );
  } catch (error) {
    yield put(
      setCategoriesError(
        error instanceof Error ? error.message : "Failed to merge categories",
      ),
    );
  }
}

export function* CategoriesSaga() {
  yield takeLatest(FetchCategories.type, handleFetchCategories);
  yield takeLatest(CreateCategory.type, handleCreateCategory);
  yield takeLatest(UpdateCategory.type, handleUpdateCategory);
  yield takeLatest(MergeCategory.type, handleMergeCategory);
}
