"use client";

import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LearningProgression } from "@/lib/types";

interface LearningPathViewProps {
  progression: LearningProgression;
}

export function LearningPathView({ progression }: LearningPathViewProps) {
  return (
    <div className="space-y-3">
      {progression.objectives.map((obj, i) => (
        <motion.div
          key={obj.order}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.06 * i }}
        >
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-start gap-3 p-4 pb-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {obj.order}
              </span>
              <div className="space-y-1">
                <CardTitle className="text-sm">{obj.title}</CardTitle>
                <Badge variant="outline" className="text-[10px]">
                  {obj.domain}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 pl-14">
              <p className="text-xs text-muted-foreground">{obj.description}</p>
              {obj.prerequisites.length > 0 && (
                <p className="mt-1 text-[10px] text-muted-foreground/70">
                  Prereqs: {obj.prerequisites.join(", ")}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
