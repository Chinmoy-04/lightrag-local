"use client";;
/**
 * @author: @kokonutui
 * @description: AI Text Loading
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export default function AITextLoading({
  texts = [
    "Thinking...",
    "Processing...",
    "Analyzing...",
    "Computing...",
    "Almost...",
  ],

  className,
  interval = 1500
}) {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTextIndex((prevIndex) => (prevIndex + 1) % texts.length);
    }, interval);

    return () => clearInterval(timer);
  }, [interval, texts.length]);

  // Upstream wraps this in a centered `p-8` block, sized for a full hero
  // loading state. Dropped here so it fits inline in a compact chat bubble;
  // callers control layout and size entirely via `className`.
  return (
    <AnimatePresence mode="wait">
      <motion.div
        animate={{
          opacity: 1,
          y: 0,
          backgroundPosition: ["200% center", "-200% center"],
        }}
        className={cn(
          "flex min-w-max items-center whitespace-nowrap bg-[length:200%_100%] bg-gradient-to-r from-neutral-950 via-neutral-400 to-neutral-950 bg-clip-text font-semibold text-transparent dark:from-white dark:via-neutral-600 dark:to-white",
          className
        )}
        exit={{ opacity: 0, y: -6 }}
        initial={{ opacity: 0, y: 6 }}
        key={currentTextIndex}
        transition={{
          opacity: { duration: 0.3 },
          y: { duration: 0.3 },
          backgroundPosition: {
            duration: 2.5,
            ease: "linear",
            repeat: Number.POSITIVE_INFINITY,
          },
        }}
      >
        {texts[currentTextIndex]}
      </motion.div>
    </AnimatePresence>
  );
}
