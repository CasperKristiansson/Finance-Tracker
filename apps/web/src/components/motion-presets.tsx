import { motion, type Variants } from "framer-motion";
import React from "react";

const ease = "easeOut" as const;

export const pageFade = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.4, ease },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.06,
    },
  },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease },
  },
};

export const subtleHover = {
  whileHover: { y: -4, scale: 1.01 },
  whileTap: { scale: 0.995 },
  transition: { type: "spring" as const, stiffness: 260, damping: 22 },
};

export const MotionPage: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <motion.div {...pageFade} className={className}>
    {children}
  </motion.div>
);

export const StaggerWrap: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <motion.div
    className={className}
    variants={staggerContainer}
    initial="hidden"
    animate="show"
  >
    {children}
  </motion.div>
);
