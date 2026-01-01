import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { CategoryRead } from "@/types/api";

export interface CategoriesState {
  items: CategoryRead[];
  loading: boolean;
  error?: string;
  createLoading: boolean;
  updateLoading: boolean;
  mutationError?: string;
  includeArchived: boolean;
}

const initialState: CategoriesState = {
  items: [],
  loading: false,
  createLoading: false,
  updateLoading: false,
  includeArchived: false,
};

const categoriesSlice = createSlice({
  name: "categories",
  initialState,
  reducers: {
    setCategories(state, action: PayloadAction<CategoryRead[]>) {
      state.items = action.payload;
      state.error = undefined;
    },
    setCategoriesLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setCategoryCreateLoading(state, action: PayloadAction<boolean>) {
      state.createLoading = action.payload;
    },
    setCategoryUpdateLoading(state, action: PayloadAction<boolean>) {
      state.updateLoading = action.payload;
    },
    setCategoriesError(state, action: PayloadAction<string | undefined>) {
      state.error = action.payload ?? "Unable to load categories";
    },
    setCategoryMutationError(state, action: PayloadAction<string | undefined>) {
      state.mutationError = action.payload;
    },
    setCategoriesFilters(
      state,
      action: PayloadAction<{ includeArchived?: boolean }>,
    ) {
      if (action.payload.includeArchived !== undefined) {
        state.includeArchived = action.payload.includeArchived;
      }
    },
  },
  selectors: {
    selectCategoriesState: (state) => state,
    selectCategories: (state) => state.items,
    selectCategoriesLoading: (state) => state.loading,
    selectCategoriesError: (state) => state.error,
    selectCategoryCreateLoading: (state) => state.createLoading,
    selectCategoryUpdateLoading: (state) => state.updateLoading,
    selectCategoryMutationError: (state) => state.mutationError,
  },
});

export const {
  setCategories,
  setCategoriesLoading,
  setCategoryCreateLoading,
  setCategoryUpdateLoading,
  setCategoriesError,
  setCategoryMutationError,
  setCategoriesFilters,
} = categoriesSlice.actions;
export const {
  selectCategoriesState,
  selectCategories,
  selectCategoriesLoading,
  selectCategoriesError,
  selectCategoryCreateLoading,
  selectCategoryUpdateLoading,
  selectCategoryMutationError,
} = categoriesSlice.selectors;
export const CategoriesReducer = categoriesSlice.reducer;
