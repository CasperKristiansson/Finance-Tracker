import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface AuthState {
  isAuthenticated: boolean;
  isInitialLoaded: boolean;
  isDemo: boolean;
  loginError: string | null;
  rememberMe: boolean;
  lastUsername: string;
  user: {
    email: string;
    accessToken: string;
    idToken: string;
    refreshToken: string;
  };
}

export const initialState: AuthState = {
  isAuthenticated: false,
  isInitialLoaded: false,
  user: {
    email: "",
    accessToken: "",
    idToken: "",
    refreshToken: "",
  },
  isDemo: false,
  loginError: null,
  rememberMe: false,
  lastUsername: "",
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    loginSuccess: (
      state,
      action: PayloadAction<AuthState["user"] & { isDemo?: boolean }>,
    ) => {
      state.isAuthenticated = true;
      state.isDemo = Boolean(action.payload.isDemo);
      state.user = action.payload;
      state.loginError = null;
    },
    logoutSuccess: (state) => {
      state.isAuthenticated = false;
      state.user = initialState.user;
      state.isDemo = false;
      state.loginError = null;
    },
    setInitialLoaded: (state) => {
      state.isInitialLoaded = true;
    },
    setLoginError: (state, action: PayloadAction<string | null>) => {
      state.loginError = action.payload;
    },
    setRememberMe: (state, action: PayloadAction<boolean>) => {
      state.rememberMe = action.payload;
    },
    setLastUsername: (state, action: PayloadAction<string>) => {
      state.lastUsername = action.payload;
    },
  },
  selectors: {
    selectIsAuthenticated: (state) => state.isAuthenticated,
    selectUser: (state) => state.user,
    selectToken: (state) => state.user.accessToken,
    selectInitialLoaded: (state) => state.isInitialLoaded,
    selectLoginError: (state) => state.loginError,
    selectRememberMe: (state) => state.rememberMe,
    selectLastUsername: (state) => state.lastUsername,
    selectIsDemo: (state) => state.isDemo,
  },
});

export const {
  loginSuccess,
  logoutSuccess,
  setInitialLoaded,
  setLoginError,
  setRememberMe,
  setLastUsername,
} = authSlice.actions;
export const {
  selectIsAuthenticated,
  selectUser,
  selectToken,
  selectInitialLoaded,
  selectLoginError,
  selectRememberMe,
  selectLastUsername,
  selectIsDemo,
} = authSlice.selectors;
export const AuthReducer = authSlice.reducer;
