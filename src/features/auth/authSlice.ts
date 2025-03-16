import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface AuthState {
  isAuthenticated: boolean;
  user: {
    email: string;
    accessToken: string;
    idToken: string;
    refreshToken: string;
  };
}

export const initialState: AuthState = {
  isAuthenticated: false,
  user: {
    email: "",
    accessToken: "",
    idToken: "",
    refreshToken: "",
  },
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    loginSuccess: (state, action: PayloadAction<AuthState["user"]>) => {
      state.isAuthenticated = true;
      state.user = action.payload;
    },
    logoutSuccess: (state) => {
      state.isAuthenticated = false;
      state.user = initialState.user;
    },
  },
  selectors: {
    selectIsAuthenticated: (state) => state.isAuthenticated,
    selectUser: (state) => state.user,
    selectToken: (state) => state.user.accessToken,
  },
});

export const { loginSuccess, logoutSuccess } = authSlice.actions;
export const { selectIsAuthenticated, selectUser, selectToken } =
  authSlice.selectors;
export const AuthReducer = authSlice.reducer;
