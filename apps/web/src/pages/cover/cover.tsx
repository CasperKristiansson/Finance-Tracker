import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { MotionPage, fadeInUp } from "@/components/motion-presets";

const coverFormSchema = z.object({
  name: z.string().min(1, "Name required").trim(),
  email: z.string().email("Valid email required").trim(),
});

type CoverFormValues = z.infer<typeof coverFormSchema>;

export const Cover: React.FC = () => {
  const coverForm = useForm<CoverFormValues>({
    resolver: zodResolver(coverFormSchema),
    defaultValues: { name: "", email: "" },
  });

  const onSubmit = coverForm.handleSubmit((values) => {
    toast.success("Joined waitlist", {
      description: `${values.email} will get early updates soon!`,
    });
    coverForm.reset({ name: "", email: "" });
  });

  return (
    <MotionPage className="h-screen bg-black">
      <motion.main
        id="content"
        className="relative z-10 mx-auto flex size-full max-w-3xl flex-col justify-center px-4 before:absolute before:start-1/2 before:top-0 before:-z-1 before:size-full before:-translate-x-1/2 before:transform before:bg-[url('https://preline.co/assets/svg/examples-dark/squared-bg-element.svg')] before:bg-top before:bg-no-repeat sm:items-center sm:px-6 lg:px-8"
        variants={fadeInUp}
        initial="hidden"
        animate="show"
      >
        <div className="px-4 py-8 text-center sm:px-6 lg:px-8">
          <h1 className="text-2xl text-white sm:text-4xl">
            Sign Up for Access
          </h1>
          <h2 className="mt-1 text-4xl font-bold text-white sm:mt-3 sm:text-6xl">
            <span className="bg-linear-to-tr from-blue-600 to-purple-400 bg-clip-text text-transparent">
              Finance Tracker
            </span>
          </h2>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="mt-8 space-y-4">
              <div>
                <label
                  htmlFor="hs-cover-with-gradient-form-name-1"
                  className="sr-only"
                >
                  Full name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="hs-cover-with-gradient-form-name-1"
                    className="block w-full rounded-lg border-white/20 bg-white/10 py-2.5 ps-11 pe-4 text-white placeholder:text-white focus:border-white/30 focus:ring-white/30 sm:p-4 sm:py-3 sm:ps-11 sm:text-sm"
                    placeholder="Full name"
                    {...coverForm.register("name")}
                  />
                  <div className="pointer-events-none absolute inset-y-0 start-0 z-20 flex items-center ps-4">
                    <svg
                      className="size-4 shrink-0 text-gray-400 dark:text-neutral-500"
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                </div>
                {coverForm.formState.errors.name ? (
                  <p className="mt-1 text-xs text-rose-200">
                    {coverForm.formState.errors.name.message}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="hs-cover-with-gradient-form-email-1"
                  className="sr-only"
                >
                  Email address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    id="hs-cover-with-gradient-form-email-1"
                    className="block w-full rounded-lg border-white/20 bg-white/10 py-2.5 ps-11 pe-4 text-white placeholder:text-white focus:border-white/30 focus:ring-white/30 sm:p-4 sm:py-3 sm:ps-11 sm:text-sm"
                    placeholder="Email address"
                    {...coverForm.register("email")}
                  />
                  <div className="pointer-events-none absolute inset-y-0 start-0 z-20 flex items-center ps-4">
                    <svg
                      className="size-4 shrink-0 text-gray-400 dark:text-neutral-500"
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </div>
                </div>
                {coverForm.formState.errors.email ? (
                  <p className="mt-1 text-xs text-rose-200">
                    {coverForm.formState.errors.email.message}
                  </p>
                ) : null}
              </div>

              <div className="grid">
                <motion.button
                  type="submit"
                  className="inline-flex items-center justify-center gap-x-2 rounded-lg border border-transparent bg-white/10 px-4 py-3 text-sm font-medium text-white hover:bg-white/20 focus:bg-white/20 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50 sm:p-4"
                  whileHover={{ y: -2, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Join the waitlist
                  <svg
                    className="size-4 shrink-0"
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </motion.button>
              </div>
            </div>
          </form>
        </div>
      </motion.main>
    </MotionPage>
  );
};
