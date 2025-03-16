import type { PayloadAction } from "@reduxjs/toolkit";
import { createSlice } from "@reduxjs/toolkit";

interface AppState {
  loading: { [key: string]: boolean };
  reRoute: string | null;
}

const initialState: AppState = {
  loading: {},
  reRoute: null,
};

const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {
    setLoading(
      state,
      action: PayloadAction<{ key: string; isLoading: boolean }>,
    ) {
      state.loading[action.payload.key] = action.payload.isLoading;
    },
    setReRoute(state, action: PayloadAction<string>) {
      state.reRoute = action.payload;
    },
  },
  selectors: {
    selectLoading: (state) => state.loading,
    selectReRoute: (state) => state.reRoute,
  },
});

export const { setLoading, setReRoute } = appSlice.actions;

export const { selectLoading, selectReRoute } = appSlice.selectors;

export const AppReducer = appSlice.reducer;
