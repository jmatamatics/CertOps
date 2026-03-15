"use client";

import { motion } from "motion/react";
import { PipelineJourney } from "@/components/pipeline-journey";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-16">
      <motion.div
        className="mb-10 text-center pt-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          Cert<span className="text-blue-500">Ops</span> Studio
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          AI-Native Certification Builder for Enterprise AI Platforms.
        </p>
      </motion.div>

      <motion.div
        className="w-full mb-16"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        <PipelineJourney />
      </motion.div>

      <motion.p
        className="mt-12 text-xs text-muted-foreground/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        Design. Assess. Certify. &mdash; All AI-powered.
      </motion.p>
    </div>
  );
}
