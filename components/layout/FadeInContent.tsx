"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

type FadeInContentProps = {
  children: ReactNode;
};

export function FadeInContent({ children }: FadeInContentProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}