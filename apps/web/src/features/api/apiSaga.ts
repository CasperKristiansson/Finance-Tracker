import { call, put, select } from "redux-saga/effects";
import { toast } from "sonner";
import { setLoading } from "@/features/app/appSlice";
import authService, { PendingApprovalError } from "@/features/auth/authHelpers";
import {
  loginSuccess,
  logoutSuccess,
  selectToken,
} from "@/features/auth/authSlice";
import { apiFetch, ApiError, type ApiRequest } from "@/lib/apiClient";

type ApiCallOptions = {
  loadingKey?: string;
  silent?: boolean;
  retryOnUnauthorized?: boolean;
};

const describeError = (error: unknown): string | undefined => {
  if (error instanceof ApiError) {
    if (typeof error.details === "string") return error.details;
    if (
      error.details &&
      typeof error.details === "object" &&
      "error" in error.details &&
      typeof (error.details as { error?: unknown }).error === "string"
    ) {
      return (error.details as { error?: string }).error;
    }
  }

  if (error instanceof Error) return error.message;
  return undefined;
};

export function* callApiWithAuth<T>(
  request: ApiRequest,
  options: ApiCallOptions = {},
): Generator<unknown, T, unknown> {
  const token = (yield select(selectToken)) as string | undefined;
  const loadingKey = options.loadingKey;

  if (loadingKey) {
    yield put(setLoading({ key: loadingKey, isLoading: true }));
  }

  try {
    const { data } = (yield call(apiFetch<T>, {
      ...request,
      token,
    })) as { data: T };
    return data;
  } catch (error) {
    const shouldRetry =
      error instanceof ApiError &&
      error.status === 401 &&
      options.retryOnUnauthorized !== false;

    if (shouldRetry) {
      try {
        const refreshedSession = (yield call(() =>
          authService.fetchAuthenticatedUser(true),
        )) as Awaited<ReturnType<typeof authService.fetchAuthenticatedUser>>;

        if (refreshedSession) {
          yield put(loginSuccess(refreshedSession));
          try {
            const { data } = (yield call(apiFetch<T>, {
              ...request,
              token: refreshedSession.accessToken,
              retryCount: 1,
            })) as { data: T };
            return data;
          } catch (retryError) {
            if (
              retryError instanceof ApiError &&
              retryError.status === 401 &&
              options.silent !== true
            ) {
              toast.error("Session expired", {
                description: "Please sign in again.",
              });
            }
            yield put(logoutSuccess());
            throw retryError;
          }
        } else {
          if (options.silent !== true) {
            toast.error("Session expired", {
              description: "Please sign in again.",
            });
          }
          yield put(logoutSuccess());
          throw error;
        }
      } catch (refreshError) {
        if (!(refreshError instanceof PendingApprovalError)) {
          if (options.silent !== true) {
            toast.error("Session expired", {
              description: "Please sign in again.",
            });
          }
        } else if (options.silent !== true) {
          toast.error("Account pending approval", {
            description:
              "Your account must be approved before continuing. Please sign in again once approved.",
          });
        }
        yield put(logoutSuccess());
        throw refreshError;
      }
    }

    if (options.silent !== true) {
      toast.error("Request failed", {
        description: describeError(error),
      });
    }

    throw error;
  } finally {
    if (loadingKey) {
      yield put(setLoading({ key: loadingKey, isLoading: false }));
    }
  }
}
