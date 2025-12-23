import { motion } from "framer-motion";
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "@/app/hooks";
import { MotionPage, fadeInUp } from "@/components/motion-presets";
import { Spinner } from "@/components/spinner";
import { PageRoutes } from "@/data/routes";
import { AuthForceLogout } from "@/features/auth/authSaga";

const clearBrowserStorage = async () => {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    // Storage access can fail in hardened browser modes.
  }

  if ("caches" in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch {
      // Cache clearing is best-effort.
    }
  }

  if ("indexedDB" in window && "databases" in indexedDB) {
    try {
      const databases = await indexedDB.databases();
      await Promise.all(
        databases.map(
          (database) =>
            new Promise<void>((resolve) => {
              if (!database.name) {
                resolve();
                return;
              }
              const request = indexedDB.deleteDatabase(database.name);
              request.onsuccess = () => resolve();
              request.onerror = () => resolve();
              request.onblocked = () => resolve();
            }),
        ),
      );
    } catch {
      // IndexedDB clearing is best-effort.
    }
  }
};

export const Logout: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    dispatch(AuthForceLogout());
    void clearBrowserStorage();
    const timer = window.setTimeout(
      () => navigate(PageRoutes.login, { replace: true }),
      200,
    );
    return () => window.clearTimeout(timer);
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
