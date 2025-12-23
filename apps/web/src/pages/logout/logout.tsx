import { motion } from "framer-motion";
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "@/app/hooks";
import { MotionPage, fadeInUp } from "@/components/motion-presets";
import { Spinner } from "@/components/spinner";
import { AuthForceLogout } from "@/features/auth/authSaga";

export const Logout: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    dispatch(AuthForceLogout());
  }, [dispatch, navigate]);

  return (
    <MotionPage className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <motion.div
        variants={fadeInUp}
        className="w-full max-w-md rounded-xl border border-gray-200 bg-white px-6 py-8 text-center shadow-2xs"
        initial="hidden"
        animate="show"
      >
        <div className="flex flex-col items-center gap-4">
          <Spinner height={32} width={32} color="#2563eb" />
          <div>
            <h1 className="text-lg font-semibold text-gray-800">
              Logging you out
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Clearing session data and returning to sign in.
            </p>
          </div>
        </div>
      </motion.div>
    </MotionPage>
  );
};
