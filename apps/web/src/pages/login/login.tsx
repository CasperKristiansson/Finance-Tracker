import React from "react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { Spinner } from "@/components/spinner";
import { selectLoading } from "@/features/app/appSlice";
import { AuthLogin, AuthLoginDemo } from "@/features/auth/authSaga";
import {
  selectLastUsername,
  selectLoginError,
  selectRememberMe,
  setLastUsername,
  setLoginError,
  setRememberMe,
} from "@/features/auth/authSlice";

export const Login: React.FC = () => {
  const dispatch = useAppDispatch();
  const loadingLogIn = useAppSelector(selectLoading)["login"];
  const rememberMe = useAppSelector(selectRememberMe);
  const lastUsername = useAppSelector(selectLastUsername);
  const loginError = useAppSelector(selectLoginError);

  const [userInformation, setUserInformation] = React.useState(() => ({
    username: lastUsername || "",
    password: "",
    remember: rememberMe,
  }));
  const [fieldErrors, setFieldErrors] = React.useState<{
    username?: string;
    password?: string;
  }>({});

  React.useEffect(() => {
    setUserInformation((prev) => ({
      ...prev,
      username: lastUsername || prev.username,
      remember: rememberMe,
    }));
  }, [lastUsername, rememberMe]);

  const validate = () => {
    const errors: { username?: string; password?: string } = {};
    if (!userInformation.username) {
      errors.username = "Email is required";
    } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(userInformation.username)) {
      errors.username = "Enter a valid email";
    }
    if (!userInformation.password) {
      errors.password = "Password is required";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(setLoginError(null));
    if (!validate()) return;
    dispatch(
      AuthLogin({
        username: userInformation.username,
        password: userInformation.password,
        rememberMe: userInformation.remember,
      }),
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="h-100v mx-auto mt-7 w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xs">
        <div className="p-4 sm:p-7">
          <div className="text-center">
            <h1 className="block text-2xl font-bold text-gray-800">Sign in</h1>
            <p className="mt-2 text-sm text-gray-600">
              Don&apos;t have an account yet?
              <a
                className="font-medium text-blue-600 decoration-2 hover:underline focus:underline focus:outline-hidden"
                href="https://www.linkedin.com/in/casperKristiansson/"
              >
                {"  "}
                Message me
              </a>
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Access is protected. Use your credentials or explore in demo mode.
            </p>
          </div>
          <div className="mt-5">
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-x-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-800 shadow-2xs hover:bg-gray-50 focus:bg-gray-50 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50"
              onClick={() => dispatch(AuthLoginDemo())}
              disabled={loadingLogIn}
            >
              Demo Account
            </button>
            <div className="flex items-center py-3 text-xs text-gray-400 uppercase before:me-6 before:flex-1 before:border-t before:border-gray-200 after:ms-6 after:flex-1 after:border-t after:border-gray-200">
              Or
            </div>
            <form onSubmit={handleSubmit} className="space-y-2">
              <div className="grid gap-y-4">
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm">
                    Email address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      id="email"
                      name="email"
                      className="block w-full rounded-lg border-1 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 sm:py-3 sm:text-sm"
                      required
                      aria-describedby="email-error"
                      onChange={(e) => {
                        setUserInformation({
                          ...userInformation,
                          username: e.target.value,
                        });
                        setFieldErrors((prev) => ({
                          ...prev,
                          username: undefined,
                        }));
                      }}
                      value={userInformation.username}
                    />
                  </div>
                  {fieldErrors.username ? (
                    <p className="mt-2 text-xs text-red-600" id="email-error">
                      {fieldErrors.username}
                    </p>
                  ) : null}
                </div>
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="password" className="mb-2 block text-sm">
                      Password
                    </label>
                    <a
                      className="inline-flex items-center gap-x-1 text-sm font-medium text-blue-600 decoration-2 hover:underline focus:underline focus:outline-hidden"
                      href="https://www.linkedin.com/in/casperKristiansson/"
                    >
                      Forgot password?
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      id="password"
                      name="password"
                      className="block w-full rounded-lg border-1 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 sm:py-3 sm:text-sm"
                      required
                      aria-describedby="password-error"
                      onChange={(e) => {
                        setUserInformation({
                          ...userInformation,
                          password: e.target.value,
                        });
                        setFieldErrors((prev) => ({
                          ...prev,
                          password: undefined,
                        }));
                      }}
                      value={userInformation.password}
                    />
                  </div>
                  {fieldErrors.password ? (
                    <p
                      className="mt-2 text-xs text-red-600"
                      id="password-error"
                    >
                      {fieldErrors.password}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center">
                  <div className="flex">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      className="mt-0.5 shrink-0 rounded-sm border-gray-200 text-blue-600 focus:ring-blue-500"
                      checked={userInformation.remember}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setUserInformation({
                          ...userInformation,
                          remember: checked,
                        });
                        dispatch(setRememberMe(checked));
                        if (!checked) {
                          dispatch(setLastUsername(""));
                        } else if (userInformation.username) {
                          dispatch(setLastUsername(userInformation.username));
                        }
                      }}
                    />
                  </div>
                  <div className="ms-3">
                    <label htmlFor="remember-me" className="text-sm">
                      Remember me
                    </label>
                  </div>
                </div>
                {loginError ? (
                  <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                    {loginError}
                  </div>
                ) : null}
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-x-2 rounded-lg border border-transparent bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 focus:bg-blue-700 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50"
                  disabled={
                    loadingLogIn ||
                    !userInformation.username ||
                    !userInformation.password
                  }
                >
                  {loadingLogIn ? (
                    <Spinner height={20} width={20} color="white" />
                  ) : (
                    "Sign in"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
