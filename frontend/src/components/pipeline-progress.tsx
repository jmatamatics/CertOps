"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "retrieve_docs", label: "Retrieve Documents", icon: "1" },
  { id: "generate_competency_framework", label: "Competency Framework", icon: "2" },
  { id: "generate_learning_progression", label: "Learning Progression", icon: "3" },
  { id: "generate_assessments", label: "Assessments", icon: "4" },
  { id: "generate_rubrics", label: "Rubrics", icon: "5" },
  { id: "generate_item_bank", label: "Item Bank", icon: "6" },
  { id: "generate_blueprint", label: "Blueprint", icon: "7" },
];

interface PipelineProgressProps {
  currentStep: number;
  isComplete: boolean;
  isError: boolean;
}

export function PipelineProgress({
  currentStep,
  isComplete,
  isError,
}: PipelineProgressProps) {
  return (
    <div className="flex flex-col gap-1">
      {STEPS.map((step, i) => {
        const isDone = isComplete || i < currentStep;
        const isActive = !isComplete && i === currentStep && !isError;
        const isPending = !isComplete && i > currentStep;

        return (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * i }}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              isDone && "text-primary",
              isActive && "bg-primary/10 text-primary font-medium",
              isPending && "text-muted-foreground/50",
              isError && i === currentStep && "bg-destructive/10 text-destructive"
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-mono",
                isDone && "border-primary bg-primary text-primary-foreground",
                isActive && "border-primary animate-pulse",
                isPending && "border-muted-foreground/30",
                isError && i === currentStep && "border-destructive bg-destructive text-destructive-foreground"
              )}
            >
              {isDone ? "\u2713" : step.icon}
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
          </motion.div>
        );
      })}
    </div>
  );
}
