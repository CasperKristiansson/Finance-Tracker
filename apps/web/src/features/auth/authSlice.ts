import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface AuthState {
  isAuthenticated: boolean;
  isInitialLoaded: boolean;
  isDemo: boolean;
  loginError: string | null;
  pendingApproval: boolean;
  rememberMe: boolean;
  lastUsername: string;
  user: {
    email: string;
    accessToken: string;
    idToken: string;
    refreshToken: string;
    approved: boolean;
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
    approved: false,
  },
  isDemo: false,
  loginError: null,
  pendingApproval: false,
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
      state.isAuthenticated = Boolean(action.payload.approved);
      state.isDemo = Boolean(action.payload.isDemo);
      state.user = action.payload;
      state.loginError = null;
      state.pendingApproval = false;
    },
    logoutSuccess: (state) => {
      state.isAuthenticated = false;
      state.user = initialState.user;
      state.isDemo = false;
      state.loginError = null;
      state.pendingApproval = false;
    },
    setInitialLoaded: (state) => {
      state.isInitialLoaded = true;
    },
    setLoginError: (state, action: PayloadAction<string | null>) => {
      state.loginError = action.payload;
    },
    setPendingApproval: (state, action: PayloadAction<boolean>) => {
      state.pendingApproval = action.payload;
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
    selectIsApproved: (state) => state.user.approved,
    selectPendingApproval: (state) => state.pendingApproval,
  },
});

export const {
  loginSuccess,
  logoutSuccess,
  setInitialLoaded,
  setLoginError,
  setPendingApproval,
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
  selectIsApproved,
  selectPendingApproval,
} = authSlice.selectors;
export const AuthReducer = authSlice.reducer;
