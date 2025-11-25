"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

type FadeInContentProps = {
  children: ReactNode;
};

export function FadeInContent({ children }: FadeInContentProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 1, 0.35, 1] }}
    >
      {children}
    </motion.div>
  );
}
