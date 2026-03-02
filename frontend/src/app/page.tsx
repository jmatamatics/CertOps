"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { TrackSelector } from "@/components/track-selector";
import type { TrackInfo } from "@/lib/types";

export default function Home() {
  const router = useRouter();

  function handleSelect(track: TrackInfo) {
    router.push(`/generate?track=${track.key}`);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <motion.div
        className="mb-12 text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          Cert<span className="text-primary">Ops</span>
        </h1>
        <p className="mt-4 max-w-lg text-lg text-muted-foreground">
          AI-Native Certification Builder for Enterprise AI Platforms.
          Select a track to generate a complete certification package.
        </p>
      </motion.div>

      <motion.div
        className="w-full max-w-2xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <TrackSelector onSelect={handleSelect} />
      </motion.div>

      <motion.p
        className="mt-12 text-xs text-muted-foreground/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        Powered by LangGraph &middot; OpenAI GPT-4o &middot; Qdrant &middot; Cohere Rerank
      </motion.p>
    </div>
  );
}
