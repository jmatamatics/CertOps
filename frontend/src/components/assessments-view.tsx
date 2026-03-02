"use client";

import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { AssessmentTask } from "@/lib/types";

interface AssessmentsViewProps {
  assessments: AssessmentTask[];
}

export function AssessmentsView({ assessments }: AssessmentsViewProps) {
  return (
    <div className="space-y-4">
      {assessments.map((task, i) => (
        <motion.div
          key={task.title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 * i }}
        >
          <Card className="border-border/50">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm">{task.title}</CardTitle>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {task.time_estimate_minutes} min
                </Badge>
              </div>
              <Badge variant="outline" className="w-fit text-[10px]">
                {task.competency_ref}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Scenario
                </p>
                <p className="text-xs">{task.scenario}</p>
              </div>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Instructions
                </p>
                <p className="text-xs">{task.instructions}</p>
              </div>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Expected Outputs
                </p>
                <ul className="list-disc pl-4">
                  {task.expected_outputs.map((o, j) => (
                    <li key={j} className="text-xs">
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
