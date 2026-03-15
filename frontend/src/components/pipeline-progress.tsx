"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { ArtifactKey } from "@/lib/types";

const STEPS = [
  { id: "retrieve_docs", label: "Retrieve Documents", icon: "1", artifact: null },
  { id: "generate_competency_framework", label: "Framework", icon: "2", artifact: "competency_framework" as ArtifactKey },
  { id: "generate_learning_progression", label: "Progression", icon: "3", artifact: "learning_progression" as ArtifactKey },
  { id: "generate_assessments", label: "Performance Tasks", icon: "4", artifact: "assessments" as ArtifactKey },
  { id: "generate_rubrics", label: "Rubrics", icon: "5", artifact: "rubrics" as ArtifactKey },
  { id: "generate_item_bank", label: "Item Bank", icon: "6", artifact: "item_bank" as ArtifactKey },
  { id: "generate_blueprint", label: "Blueprint", icon: "7", artifact: "blueprint" as ArtifactKey },
];

const ARTIFACT_ORDER: ArtifactKey[] = [
  "competency_framework",
  "learning_progression",
  "assessments",
  "rubrics",
  "item_bank",
  "blueprint",
];

interface PipelineProgressProps {
  currentStep: number;
  isComplete: boolean;
  isError: boolean;
  replayingFrom?: ArtifactKey | null;
}

export function PipelineProgress({
  currentStep,
  isComplete,
  isError,
  replayingFrom,
}: PipelineProgressProps) {
  const replayStartIdx = replayingFrom
    ? ARTIFACT_ORDER.indexOf(replayingFrom)
    : -1;

  return (
    <div className="flex flex-col gap-1">
      {replayingFrom && (
        <p className="text-xs text-muted-foreground mb-2 px-3">
          Replaying downstream artifacts...
        </p>
      )}
      {STEPS.map((step, i) => {
        const artifactIdx = step.artifact
          ? ARTIFACT_ORDER.indexOf(step.artifact)
          : -1;

        const isReplaying = replayingFrom && artifactIdx > replayStartIdx;
        const isReplayDone = replayingFrom && artifactIdx >= 0 && artifactIdx <= replayStartIdx;

        const isDone = replayingFrom
          ? (isReplayDone || (i === 0))
          : (isComplete || i < currentStep);
        const isActive = replayingFrom
          ? false
          : (!isComplete && i === currentStep && !isError);
        const isPending = replayingFrom
          ? !!isReplaying
          : (!isComplete && i > currentStep);

        return (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * i }}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              isDone && !isReplaying && "text-primary",
              isActive && "bg-primary/10 text-primary font-medium",
              isPending && !isReplaying && "text-muted-foreground/50",
              isReplaying && "bg-amber-500/10 text-amber-400 font-medium",
              isError && i === currentStep && "bg-destructive/10 text-destructive"
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-mono",
                isDone && !isReplaying && "border-primary bg-primary text-primary-foreground",
                isActive && "border-primary animate-pulse",
                isPending && !isReplaying && "border-muted-foreground/30",
                isReplaying && "border-amber-400 animate-pulse",
                isError && i === currentStep && "border-destructive bg-destructive text-destructive-foreground"
              )}
            >
              {isDone && !isReplaying ? "\u2713" : step.icon}
            </span>
            <span>{step.label}</span>
            {isActive && (
              <motion.span
                className="ml-auto text-xs text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ repeat: Infinity, repeatType: "reverse", duration: 0.8 }}
              >
                running...
              </motion.span>
            )}
            {isReplaying && (
              <motion.span
                className="ml-auto text-xs text-amber-400/70"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ repeat: Infinity, repeatType: "reverse", duration: 0.8 }}
              >
                replaying...
              </motion.span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
