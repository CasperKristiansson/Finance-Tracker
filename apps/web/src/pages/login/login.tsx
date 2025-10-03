import React from "react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { Spinner } from "@/components/spinner";
import { selectLoading } from "@/features/app/appSlice";
import { AuthLogin } from "@/features/auth/authSaga";

export const Login: React.FC = () => {
  const dispatch = useAppDispatch();
  const loadingLogIn = useAppSelector(selectLoading)["login"];

  const [userInformation, setUserInformation] = React.useState({
    username: "",
    password: "",
  });

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
          </div>
          <div className="mt-5">
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-x-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-800 shadow-2xs hover:bg-gray-50 focus:bg-gray-50 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50"
            >
              Demo Account
            </button>
            <div className="flex items-center py-3 text-xs text-gray-400 uppercase before:me-6 before:flex-1 before:border-t before:border-gray-200 after:ms-6 after:flex-1 after:border-t after:border-gray-200">
              Or
            </div>
            <form>
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
                      onChange={(e) =>
                        setUserInformation({
                          ...userInformation,
                          username: e.target.value,
                        })
                      }
                    />
                    <div className="pointer-events-none absolute inset-y-0 end-0 hidden pe-3">
                      <svg
                        className="size-5 text-red-500"
                        width="16"
                        height="16"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                        aria-hidden="true"
                      >
                        <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM8 4a.905.905 0 0 0-.9.995l.35 3.507a.552.552 0 0 0 1.1 0l.35-3.507A.905.905 0 0 0 8 4zm.002 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
                      </svg>
                    </div>
                  </div>
                  <p
                    className="mt-2 hidden text-xs text-red-600"
                    id="email-error"
                  >
                    Please include a valid email address so we can get back to
                    you
                  </p>
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
                      onChange={(e) =>
                        setUserInformation({
                          ...userInformation,
                          password: e.target.value,
                        })
                      }
                    />
                    <div className="pointer-events-none absolute inset-y-0 end-0 hidden pe-3">
                      <svg
                        className="size-5 text-red-500"
                        width="16"
                        height="16"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                        aria-hidden="true"
                      >
                        <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM8 4a.905.905 0 0 0-.9.995l.35 3.507a.552.552 0 0 0 1.1 0l.35-3.507A.905.905 0 0 0 8 4zm.002 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
                      </svg>
                    </div>
                  </div>
                  <p
                    className="mt-2 hidden text-xs text-red-600"
                    id="password-error"
                  >
                    8+ characters required
                  </p>
                </div>
                <div className="flex items-center">
                  <div className="flex">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      className="mt-0.5 shrink-0 rounded-sm border-gray-200 text-blue-600 focus:ring-blue-500"
                    />
                  </div>
                  <div className="ms-3">
                    <label htmlFor="remember-me" className="text-sm">
                      Remember me
                    </label>
                  </div>
                </div>
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-x-2 rounded-lg border border-transparent bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 focus:bg-blue-700 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50"
                  onClick={(e) => {
                    e.preventDefault();
                    dispatch(AuthLogin(userInformation));
                    setUserInformation({ username: "", password: "" });
                  }}
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
