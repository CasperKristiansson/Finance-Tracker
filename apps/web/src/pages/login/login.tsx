import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { MotionPage, fadeInUp } from "@/components/motion-presets";
import { Spinner } from "@/components/spinner";
import { selectLoading } from "@/features/app/appSlice";
import { AuthLoginDemo, AuthLoginGoogle } from "@/features/auth/authSaga";
import {
  selectLastUsername,
  selectLoginError,
  selectRememberMe,
  setLastUsername,
  setLoginError,
  setRememberMe,
} from "@/features/auth/authSlice";

const loginFormSchema = z.object({
  email: z.string().email("Valid email required").trim(),
  remember: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export const Login: React.FC = () => {
  const dispatch = useAppDispatch();
  const loadingLogIn = useAppSelector(selectLoading)["login"];
  const loginError = useAppSelector(selectLoginError);
  const lastUsername = useAppSelector(selectLastUsername);
  const rememberMe = useAppSelector(selectRememberMe);

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: lastUsername || "",
      remember: rememberMe,
    },
  });

  useEffect(() => {
    loginForm.reset({ email: lastUsername || "", remember: rememberMe });
  }, [lastUsername, rememberMe, loginForm]);

  const handleEmailSubmit = loginForm.handleSubmit((values) => {
    dispatch(setLoginError(null));
    dispatch(setRememberMe(Boolean(values.remember)));
    if (values.email) {
      dispatch(setLastUsername(values.email));
    }
    dispatch(AuthLoginGoogle());
  });

  return (
    <MotionPage className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <motion.div
        variants={fadeInUp}
        className="h-100v mx-auto mt-7 w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xs"
        initial="hidden"
        animate="show"
      >
        <div className="p-4 sm:p-7">
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
              onClick={() => dispatch(AuthLoginDemo())}
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
              <form className="space-y-3" onSubmit={handleEmailSubmit}>
                <div className="space-y-1 text-left">
                  <label className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                    Email
                  </label>
                  <input
                    type="email"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800"
                    placeholder="you@example.com"
                    {...loginForm.register("email")}
                  />
                  {loginForm.formState.errors.email ? (
                    <p className="text-xs text-red-600">
                      {loginForm.formState.errors.email.message}
                    </p>
                  ) : null}
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300"
                    {...loginForm.register("remember")}
                  />
                  Remember me on this device
                </label>
                {loginError ? (
                  <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                    {loginError}
                  </div>
                ) : null}
                <motion.button
                  type="submit"
                  className="inline-flex w-full cursor-pointer items-center justify-center gap-x-2 rounded-lg border border-transparent bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 focus:bg-blue-700 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50"
                  disabled={loadingLogIn}
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
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
              </form>
            </div>
          </div>
        </div>
      </motion.div>
    </MotionPage>
  );
};
