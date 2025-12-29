import { createAction } from "@reduxjs/toolkit";
import { call, put, select, takeLatest } from "redux-saga/effects";
import { demoCategories } from "@/data/demoPayloads";
import { callApiWithAuth } from "@/features/api/apiSaga";
import { selectIsDemo } from "@/features/auth/authSlice";
import {
  selectCategories,
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
  const isDemo: boolean = yield select(selectIsDemo);
  if (action.payload) {
    yield put(setCategoriesFilters(action.payload));
  }

  try {
    if (isDemo) {
      yield put(setCategories(demoCategories.categories));
      return;
    }

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
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    const body = categoryCreateRequestSchema.parse(action.payload);
    if (isDemo) {
      const current = (yield select(
        selectCategories,
      )) as CategoryListResponse["categories"];
      const now = new Date().toISOString();
      yield put(
        setCategories([
          ...current,
          {
            id: `demo-category-${Date.now()}`,
            name: body.name,
            category_type: body.category_type,
            color_hex: body.color_hex ?? null,
            icon: body.icon ?? null,
            is_archived: false,
            created_at: now,
            updated_at: now,
            transaction_count: 0,
            last_used_at: null,
            lifetime_total: "0",
            recent_months: [],
          },
        ]),
      );
      return;
    }

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
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    const body = categoryUpdateRequestSchema.parse(action.payload.data);
    if (isDemo) {
      const current = (yield select(
        selectCategories,
      )) as CategoryListResponse["categories"];
      yield put(
        setCategories(
          current.map((cat) =>
            cat.id === action.payload.id
              ? {
                  ...cat,
                  ...body,
                  color_hex: body.color_hex ?? cat.color_hex,
                  icon: body.icon ?? cat.icon,
                  updated_at: new Date().toISOString(),
                }
              : cat,
          ),
        ),
      );
      return;
    }

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
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    if (isDemo) {
      const current = (yield select(
        selectCategories,
      )) as CategoryListResponse["categories"];
      const merged = current.filter(
        (cat) => cat.id !== action.payload.sourceCategoryId,
      );
      const targetIndex = merged.findIndex(
        (cat) => cat.id === action.payload.targetCategoryId,
      );
      if (targetIndex >= 0 && action.payload.renameTargetTo) {
        merged[targetIndex] = {
          ...merged[targetIndex],
          name: action.payload.renameTargetTo,
          updated_at: new Date().toISOString(),
        };
      }
      yield put(setCategories(merged));
      return;
    }

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
