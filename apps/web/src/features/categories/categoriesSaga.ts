import { createAction } from "@reduxjs/toolkit";
import type { SagaIterator } from "redux-saga";
import { call, put, select, takeLatest } from "redux-saga/effects";
import { demoCategories } from "@/data/demoPayloads";
import { callApiWithAuth } from "@/features/api/apiSaga";
import { selectIsDemo } from "@/features/auth/authSlice";
import {
  selectCategories,
  setCategoryOptions,
  setCategoryOptionsError,
  setCategoryOptionsLoading,
  selectCategoriesState,
  setCategories,
  setCategoriesError,
  setCategoriesFilters,
  setCategoriesLoading,
  setCategoryCreateLoading,
  setCategoryMutationError,
  setCategoryUpdateLoading,
  type CategoriesState,
} from "@/features/categories/categoriesSlice";
import { buildEndpointRequest } from "@/lib/apiEndpoints";
import type { CategoryRead } from "@/types/api";
import type { EndpointRequest, EndpointResponse } from "@/types/contracts";

export const FetchCategories = createAction<
  Partial<Pick<CategoriesState, "includeArchived">> | undefined
>("categories/fetch");
export const FetchCategoryOptions = createAction<
  Pick<CategoriesState, "includeArchived"> | undefined
>("categories/fetchOptions");
export const CreateCategory =
  createAction<EndpointRequest<"createCategory">>("categories/create");
export const UpdateCategory = createAction<{
  id: string;
  data: EndpointRequest<"updateCategory">;
}>("categories/update");
export const MergeCategory = createAction<{
  sourceCategoryId: string;
  targetCategoryId: string;
  renameTargetTo?: string;
}>("categories/merge");

function* handleFetchCategories(
  action: ReturnType<typeof FetchCategories>,
): SagaIterator {
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

    const response: EndpointResponse<"listCategories"> = yield call(
      callApiWithAuth,
      buildEndpointRequest("listCategories", {
        query,
      }),
      { loadingKey: "categories" },
    );

    const normalized: CategoryRead[] = response.categories.map((category) => ({
      ...category,
      transaction_count: category.transaction_count ?? 0,
      lifetime_total: category.lifetime_total ?? "0",
      recent_months: category.recent_months ?? [],
    }));
    yield put(setCategories(normalized));
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

function* handleFetchCategoryOptions(
  action: ReturnType<typeof FetchCategoryOptions>,
): SagaIterator {
  const state: CategoriesState = yield select(selectCategoriesState);
  const includeArchived =
    action.payload?.includeArchived ?? state.includeArchived;
  yield put(setCategoryOptionsLoading(true));
  const isDemo: boolean = yield select(selectIsDemo);

  try {
    if (isDemo) {
      const options = demoCategories.categories.map((category) => ({
        id: category.id,
        name: category.name,
        category_type: category.category_type,
        color_hex: category.color_hex,
        icon: category.icon,
        is_archived: category.is_archived,
      }));
      yield put(setCategoryOptions(options));
      return;
    }

    const response: EndpointResponse<"listCategoryOptions"> = yield call(
      callApiWithAuth,
      buildEndpointRequest("listCategoryOptions", {
        query: {
          include_archived: includeArchived,
          include_special: false,
        },
      }),
      { loadingKey: "category-options" },
    );
    yield put(setCategoryOptions(response.options));
  } catch (error) {
    yield put(
      setCategoryOptionsError(
        error instanceof Error
          ? error.message
          : "Failed to load category options",
      ),
    );
  } finally {
    yield put(setCategoryOptionsLoading(false));
  }
}

function* handleCreateCategory(
  action: ReturnType<typeof CreateCategory>,
): SagaIterator {
  const isDemo: boolean = yield select(selectIsDemo);
  yield put(setCategoryCreateLoading(true));
  yield put(setCategoryMutationError(undefined));
  try {
    const body: EndpointRequest<"createCategory"> = action.payload;
    if (isDemo) {
      const current = (yield select(
        selectCategories,
      )) as CategoriesState["items"];
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
      buildEndpointRequest("createCategory", { body }),
      { loadingKey: "categories" },
    );
    const state: CategoriesState = yield select(selectCategoriesState);
    yield call(
      handleFetchCategories,
      FetchCategories({ includeArchived: state.includeArchived }),
    );
  } catch (error) {
    yield put(
      setCategoryMutationError(
        error instanceof Error ? error.message : "Failed to create category",
      ),
    );
  } finally {
    yield put(setCategoryCreateLoading(false));
  }
}

function* handleUpdateCategory(
  action: ReturnType<typeof UpdateCategory>,
): SagaIterator {
  const isDemo: boolean = yield select(selectIsDemo);
  yield put(setCategoryUpdateLoading(true));
  yield put(setCategoryMutationError(undefined));
  try {
    const body: EndpointRequest<"updateCategory"> = action.payload.data;
    if (isDemo) {
      const current = (yield select(
        selectCategories,
      )) as CategoriesState["items"];
      yield put(
        setCategories(
          current.map((cat) =>
            cat.id === action.payload.id
              ? {
                  ...cat,
                  name: body.name ?? cat.name,
                  category_type: body.category_type ?? cat.category_type,
                  color_hex:
                    body.color_hex !== undefined
                      ? body.color_hex
                      : cat.color_hex,
                  icon: body.icon !== undefined ? body.icon : cat.icon,
                  is_archived: body.is_archived ?? cat.is_archived,
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
      buildEndpointRequest("updateCategory", {
        pathParams: { categoryId: action.payload.id },
        body,
      }),
      { loadingKey: "categories" },
    );
    const state: CategoriesState = yield select(selectCategoriesState);
    yield call(
      handleFetchCategories,
      FetchCategories({ includeArchived: state.includeArchived }),
    );
  } catch (error) {
    yield put(
      setCategoryMutationError(
        error instanceof Error ? error.message : "Failed to update category",
      ),
    );
  } finally {
    yield put(setCategoryUpdateLoading(false));
  }
}

function* handleMergeCategory(
  action: ReturnType<typeof MergeCategory>,
): SagaIterator {
  const isDemo: boolean = yield select(selectIsDemo);
  yield put(setCategoryMutationError(undefined));
  try {
    if (isDemo) {
      const current = (yield select(
        selectCategories,
      )) as CategoriesState["items"];
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
      buildEndpointRequest("mergeCategories", {
        body: {
          source_category_id: action.payload.sourceCategoryId,
          target_category_id: action.payload.targetCategoryId,
          rename_target_to: action.payload.renameTargetTo,
        },
      }),
      { loadingKey: "categories" },
    );
    const state: CategoriesState = yield select(selectCategoriesState);
    yield call(
      handleFetchCategories,
      FetchCategories({ includeArchived: state.includeArchived }),
    );
  } catch (error) {
    yield put(
      setCategoryMutationError(
        error instanceof Error ? error.message : "Failed to merge categories",
      ),
    );
  }
}

export function* CategoriesSaga(): SagaIterator {
  yield takeLatest(FetchCategories.type, handleFetchCategories);
  yield takeLatest(FetchCategoryOptions.type, handleFetchCategoryOptions);
  yield takeLatest(CreateCategory.type, handleCreateCategory);
  yield takeLatest(UpdateCategory.type, handleUpdateCategory);
  yield takeLatest(MergeCategory.type, handleMergeCategory);
}
