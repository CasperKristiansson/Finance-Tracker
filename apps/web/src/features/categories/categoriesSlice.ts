import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { CategoryRead } from "@/types/api";

export interface CategoriesState {
  items: CategoryRead[];
  loading: boolean;
  error?: string;
  includeArchived: boolean;
}

const initialState: CategoriesState = {
  items: [],
  loading: false,
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
    setCategoriesError(state, action: PayloadAction<string | undefined>) {
      state.error = action.payload ?? "Unable to load categories";
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
  },
});

export const {
  setCategories,
  setCategoriesLoading,
  setCategoriesError,
  setCategoriesFilters,
} = categoriesSlice.actions;
export const {
  selectCategoriesState,
  selectCategories,
  selectCategoriesLoading,
  selectCategoriesError,
} = categoriesSlice.selectors;
export const CategoriesReducer = categoriesSlice.reducer;
