import { motion } from "framer-motion";
import React from "react";
import { useLocation } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { MotionPage, fadeInUp } from "@/components/motion-presets";
import { Spinner } from "@/components/spinner";
import { selectLoading } from "@/features/app/appSlice";
import {
  AuthLoginDemo,
  AuthLoginGoogle,
  PENDING_APPROVAL_MESSAGE,
} from "@/features/auth/authSaga";
import {
  selectLoginError,
  selectIsAuthenticated,
  selectPendingApproval,
  setLoginError,
} from "@/features/auth/authSlice";

export const Login: React.FC = () => {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const loadingLogIn = useAppSelector(selectLoading)["login"];
  const loginError = useAppSelector(selectLoginError);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const pendingApproval = useAppSelector(selectPendingApproval);
  const hasAuthCode = new URLSearchParams(location.search).has("code");
  const showPendingApproval =
    pendingApproval || (!isAuthenticated && hasAuthCode);
  const startGoogle = () => {
    dispatch(setLoginError(null));
    dispatch(AuthLoginGoogle());
  };
  const startDemo = () => {
    dispatch(setLoginError(null));
    dispatch(AuthLoginDemo());
  };
  return (
    <MotionPage className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <motion.div
        variants={fadeInUp}
        className="h-100v mx-auto mt-7 w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xs"
        initial="hidden"
        animate="show"
      >
        <div className="p-4 sm:p-7">
          {showPendingApproval ? (
            <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <div className="flex flex-col gap-1">
                <div>
                  <p className="font-semibold">{PENDING_APPROVAL_MESSAGE}</p>
                  <p className="text-amber-800">
                    Try using the demo account in the meantime.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          <div className="text-center">
            <h1 className="block text-2xl font-bold text-gray-800">Sign in</h1>
            <p className="mt-2 text-xs text-gray-500">
              Access is protected. Use your credentials or explore in demo mode.
            </p>
          </div>
          <div className="mt-5">
            <motion.button
              type="button"
              className="inline-flex w-full items-center justify-center gap-x-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-800 shadow-2xs hover:bg-gray-50 focus:bg-gray-50 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50"
              onClick={startDemo}
              disabled={loadingLogIn}
              whileHover={{ y: -2, scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              Demo Account
            </motion.button>
            <div className="flex items-center py-3 text-xs text-gray-400 uppercase before:me-6 before:flex-1 before:border-t before:border-gray-200 after:ms-6 after:flex-1 after:border-t after:border-gray-200">
              Or
            </div>
            <div className="space-y-3">
              {loginError && !showPendingApproval ? (
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {loginError}
                </div>
              ) : null}
              <motion.button
                type="button"
                className="inline-flex w-full cursor-pointer items-center justify-center gap-x-2 rounded-lg border border-transparent bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 focus:bg-blue-700 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50"
                disabled={loadingLogIn}
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={startGoogle}
              >
                {loadingLogIn ? (
                  <Spinner height={20} width={20} color="white" />
                ) : (
                  <>
                    <img
                      src="/google.webp"
                      alt="Google icon"
                      className="h-4 w-4"
                      loading="lazy"
                    />
                    <span>Continue with Google</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </MotionPage>
  );
};
