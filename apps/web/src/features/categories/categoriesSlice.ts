import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { CategoryRead } from "@/types/api";
import type { EndpointResponse } from "@/types/contracts";

type CategoryOption =
  EndpointResponse<"listCategoryOptions">["options"][number];

export interface CategoriesState {
  items: CategoryRead[];
  options: CategoryOption[];
  loading: boolean;
  optionsLoading: boolean;
  error?: string;
  optionsError?: string;
  createLoading: boolean;
  updateLoading: boolean;
  mutationError?: string;
  includeArchived: boolean;
}

const initialState: CategoriesState = {
  items: [],
  options: [],
  loading: false,
  optionsLoading: false,
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
    setCategoryOptions(state, action: PayloadAction<CategoryOption[]>) {
      state.options = action.payload;
      state.optionsError = undefined;
    },
    setCategoriesLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setCategoryOptionsLoading(state, action: PayloadAction<boolean>) {
      state.optionsLoading = action.payload;
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
    setCategoryOptionsError(state, action: PayloadAction<string | undefined>) {
      state.optionsError = action.payload ?? "Unable to load category options";
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
    selectCategoryOptions: (state) => state.options,
    selectCategoriesLoading: (state) => state.loading,
    selectCategoryOptionsLoading: (state) => state.optionsLoading,
    selectCategoriesError: (state) => state.error,
    selectCategoryOptionsError: (state) => state.optionsError,
    selectCategoryCreateLoading: (state) => state.createLoading,
    selectCategoryUpdateLoading: (state) => state.updateLoading,
    selectCategoryMutationError: (state) => state.mutationError,
  },
});

export const {
  setCategories,
  setCategoryOptions,
  setCategoriesLoading,
  setCategoryOptionsLoading,
  setCategoryCreateLoading,
  setCategoryUpdateLoading,
  setCategoriesError,
  setCategoryOptionsError,
  setCategoryMutationError,
  setCategoriesFilters,
} = categoriesSlice.actions;
export const {
  selectCategoriesState,
  selectCategories,
  selectCategoryOptions,
  selectCategoriesLoading,
  selectCategoryOptionsLoading,
  selectCategoriesError,
  selectCategoryOptionsError,
  selectCategoryCreateLoading,
  selectCategoryUpdateLoading,
  selectCategoryMutationError,
} = categoriesSlice.selectors;
export const CategoriesReducer = categoriesSlice.reducer;
