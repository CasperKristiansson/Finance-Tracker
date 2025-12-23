import { createAction } from "@reduxjs/toolkit";
import { all, call, put, select, takeLatest } from "redux-saga/effects";
import { toast } from "sonner";
import { resetAccounts } from "@/features/accounts/accountsSlice";
import { resetReports } from "@/features/reports/reportsSlice";
import { resetTransactions } from "@/features/transactions/transactionsSlice";
import { authSessionSchema } from "@/types/schemas";
import { setLoading } from "../app/appSlice";
import { resetWarmup } from "../warmup/warmupSlice";
import authService, {
  PendingApprovalError,
  type AuthenticatedUser,
} from "./authHelpers";
import {
  loginSuccess,
  logoutSuccess,
  selectLastUsername,
  selectIsDemo,
  selectRememberMe,
  setInitialLoaded,
  setLastUsername,
  setLoginError,
  setPendingApproval,
  setRememberMe,
} from "./authSlice";

export const AuthLoginGoogle = createAction("auth/loginGoogle");
export const AuthLogout = createAction("auth/logout");
export const AuthForceLogout = createAction("auth/forceLogout");
export const AuthInitialize = createAction("auth/initialize");
export const AuthLoginDemo = createAction("auth/loginDemo");

const REMEMBER_KEY = "finance-tracker-remember";
const REMEMBER_USERNAME_KEY = "finance-tracker-last-username";
export const PENDING_APPROVAL_MESSAGE =
  "Your account is pending approval. An admin must approve access before you can sign in.";

const safeStringify = (value: unknown): string => {
  const seen = new WeakSet<object>();
  try {
    return (
      JSON.stringify(value, (_, candidate) => {
        if (typeof candidate === "object" && candidate !== null) {
          if (seen.has(candidate)) return undefined;
          seen.add(candidate);
        }
        return candidate;
      }) ?? ""
    );
  } catch {
    return "";
  }
};

const collectErrorStrings = (error: unknown): string[] => {
  const strings: string[] = [];
  const queue: Array<{ value: unknown; depth: number }> = [
    { value: error, depth: 0 },
  ];
  const seen = new WeakSet<object>();
  const maxDepth = 3;

  const addString = (value: unknown) => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (!trimmed || trimmed === "[object Object]") return;
    strings.push(trimmed);
  };

  while (queue.length) {
    const item = queue.shift();
    if (!item) break;
    const { value, depth } = item;
    if (!value) continue;

    if (typeof value === "string") {
      addString(value);
      continue;
    }

    if (value instanceof Error) {
      addString(value.message);
      addString(value.name);
      const cause = (value as { cause?: unknown }).cause;
      if (cause) {
        queue.push({ value: cause, depth: depth + 1 });
      }
      continue;
    }

    if (typeof value !== "object") {
      addString(String(value));
      continue;
    }

    if (seen.has(value)) continue;
    seen.add(value);
    if (depth >= maxDepth) continue;

    const record = value as Record<string, unknown>;
    Object.values(record).forEach((child) => {
      queue.push({ value: child, depth: depth + 1 });
    });
  }

  const serialized = safeStringify(error);
  addString(serialized);
  addString(String(error));

  return Array.from(new Set(strings));
};

const extractErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  const candidates = collectErrorStrings(error);
  return candidates[0] ?? "";
};

const isPendingApprovalError = (error: unknown): boolean => {
  if (error instanceof PendingApprovalError) return true;
  const tokens = [
    "user_not_approved",
    "pending approval",
    "userlambdavalidationexception",
    "pretokengeneration failed",
  ];
  return collectErrorStrings(error).some((text) => {
    const normalized = text.toLowerCase();
    return tokens.some((token) => normalized.includes(token));
  });
};

const persistRememberMe = (remember: boolean, username?: string) => {
  if (remember) {
    localStorage.setItem(REMEMBER_KEY, "1");
    if (username) {
      localStorage.setItem(REMEMBER_USERNAME_KEY, username);
    }
  } else {
    localStorage.removeItem(REMEMBER_KEY);
    localStorage.removeItem(REMEMBER_USERNAME_KEY);
  }
};

const hydrateRemembered = () => {
  if (typeof window === "undefined") return { remember: false, username: "" };
  const remember = localStorage.getItem(REMEMBER_KEY) === "1";
  const username = localStorage.getItem(REMEMBER_USERNAME_KEY) ?? "";
  return { remember, username };
};

function* handleLoginWithGoogle() {
  yield put(setLoading({ key: "login", isLoading: true }));
  yield put(setLoginError(null));
  try {
    const existingSession: AuthenticatedUser | null = yield call(() =>
      authService.fetchAuthenticatedUser(),
    );
    if (existingSession) {
      const parsed = authSessionSchema.safeParse(existingSession);
      if (parsed.success) {
        yield put(loginSuccess(parsed.data));
        return;
      }
    }

    yield call(() => authService.signInWithGoogle());
  } catch (error) {
    if (isPendingApprovalError(error)) {
      yield put(setLoginError(PENDING_APPROVAL_MESSAGE));
      yield put(setPendingApproval(true));
      toast.error("Account pending approval", {
        description: PENDING_APPROVAL_MESSAGE,
      });
      try {
        yield call(() => authService.signOut());
      } catch {
        // ignore sign-out cleanup errors
      }
      yield put(setLoading({ key: "login", isLoading: false }));
      return;
    }

    const message =
      extractErrorMessage(error) || "Failed to start Google sign-in";
    const alreadySignedIn = message.toLowerCase().includes("signed in user");

    if (alreadySignedIn) {
      try {
        const session: AuthenticatedUser | null = yield call(() =>
          authService.fetchAuthenticatedUser(true),
        );
        const parsed = session ? authSessionSchema.safeParse(session) : null;
        if (parsed?.success) {
          yield put(loginSuccess(parsed.data));
          return;
        }
      } catch {
        // fall through to error toast below
      }
    }

    yield put(setLoginError(message));
    toast.error("Failed to start Google sign-in", {
      description: message,
    });
  }
  yield put(setLoading({ key: "login", isLoading: false }));
}

function* handleLogout() {
  yield put(setLoading({ key: "logout", isLoading: true }));
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    if (!isDemo) {
      yield call(() => authService.signOut());
    }
    yield put(logoutSuccess());
    yield put(resetAccounts());
    yield put(resetTransactions());
    yield put(resetReports());
    yield put(resetWarmup());
    toast.success("Logout Successful");
  } catch (error) {
    if (error instanceof Error) {
      toast.error("Failed to Logout", {
        description: error.message,
      });
    } else {
      toast.error("Failed to Logout");
    }
  }
  yield put(setLoading({ key: "logout", isLoading: false }));
}

function* handleForceLogout() {
  yield put(setLoading({ key: "logout", isLoading: true }));
  try {
    yield call(() => authService.signOut());
  } catch {
    // Best-effort sign-out for forced logout.
  }
  yield put(logoutSuccess());
  yield put(resetAccounts());
  yield put(resetTransactions());
  yield put(resetReports());
  yield put(resetWarmup());
  yield put(setLoading({ key: "logout", isLoading: false }));
}

function* initializeAuth() {
  const { remember, username } = hydrateRemembered();
  yield put(setRememberMe(remember));
  if (username) {
    yield put(setLastUsername(username));
  }
  try {
    yield call(() => authService.completeRedirectIfPresent());
    const existingSession: AuthenticatedUser | null = yield call(() =>
      authService.fetchAuthenticatedUser(),
    );

    if (existingSession) {
      const parsed = authSessionSchema.safeParse(existingSession);
      if (parsed.success) {
        yield put(loginSuccess({ ...parsed.data }));
      } else {
        console.error("Invalid session payload from auth provider", {
          issues: parsed.error.format(),
          session: existingSession,
        });
        toast.error("Failed to restore session", {
          description: "Session payload was invalid.",
        });
      }
    }
  } catch (error) {
    if (isPendingApprovalError(error)) {
      yield put(setLoginError(PENDING_APPROVAL_MESSAGE));
      yield put(setPendingApproval(true));
      toast.error("Account pending approval", {
        description: PENDING_APPROVAL_MESSAGE,
      });
      try {
        yield call(() => authService.signOut());
      } catch {
        // ignore cleanup failures during sign-out
      }
      yield put(setInitialLoaded());
      return;
    }

    console.error("Failed to restore session", error);
    if (error instanceof Error) {
      toast.error("Failed to restore session", {
        description: error.message,
      });
    } else {
      toast.error("Failed to restore session");
    }
  }
  yield put(setInitialLoaded());
}

function* handleLoginDemo() {
  yield put(setLoading({ key: "login", isLoading: true }));
  yield put(setLoginError(null));
  const rememberedUsername: string = yield select(selectLastUsername);
  const remember: boolean = yield select(selectRememberMe);
  if (remember) {
    persistRememberMe(true, rememberedUsername || "demo@fintrack.local");
    yield put(setLastUsername(rememberedUsername || "demo@fintrack.local"));
  }
  yield put(
    loginSuccess({
      email: rememberedUsername || "demo@fintrack.local",
      accessToken: "demo-access-token",
      idToken: "demo-id-token",
      refreshToken: "demo-refresh-token",
      approved: true,
      isDemo: true,
    }),
  );
  toast.success("Demo mode enabled", {
    description: "You are browsing with demo data.",
  });
  yield put(setLoading({ key: "login", isLoading: false }));
}

export function* AuthSaga() {
  yield all([
    takeLatest(AuthLoginGoogle.type, handleLoginWithGoogle),
    takeLatest(AuthLogout.type, handleLogout),
    takeLatest(AuthForceLogout.type, handleForceLogout),
    takeLatest(AuthInitialize.type, initializeAuth),
    takeLatest(AuthLoginDemo.type, handleLoginDemo),
  ]);
}
