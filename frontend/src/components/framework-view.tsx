"use client";

import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { CompetencyFramework } from "@/lib/types";

interface FrameworkViewProps {
  framework: CompetencyFramework;
}

const LEVEL_STYLES: Record<string, { border: string; label: string }> = {
  novice: {
    border: "border-red-500/20 bg-red-500/5",
    label: "text-red-400",
  },
  competent: {
    border: "border-amber-500/20 bg-amber-500/5",
    label: "text-amber-400",
  },
  expert: {
    border: "border-emerald-500/20 bg-emerald-500/5",
    label: "text-emerald-400",
  },
};

export function FrameworkView({ framework }: FrameworkViewProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">
          {framework.track}
        </h3>
        <p className="text-sm text-muted-foreground">{framework.description}</p>
      </div>

      {framework.domains.map((domain, i) => (
        <motion.div
          key={domain.name}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 * i }}
        >
          <Card className="border-border/50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border/50">
              <h4 className="font-semibold text-sm">{domain.name}</h4>
              <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20">
                {domain.skills.length} skills
              </Badge>
            </div>
            <CardContent className="p-4 space-y-4">
              <p className="text-sm text-muted-foreground">{domain.description}</p>

              {domain.skills.map((skill) => (
                <div key={skill.name} className="rounded-lg border border-border/50 p-3 space-y-3">
                  <div>
                    <p className="font-semibold text-sm">{skill.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{skill.description}</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {skill.proficiency_levels.map((lvl) => {
                      const style = LEVEL_STYLES[lvl.level] ?? { border: "", label: "" };
                      return (
                        <div
                          key={lvl.level}
                          className={`rounded-md border p-2.5 ${style.border}`}
                        >
                          <p className={`text-xs font-semibold capitalize mb-1 ${style.label}`}>
                            {lvl.level}
                          </p>
                          <p className="text-[11px] text-muted-foreground mb-1.5">
                            {lvl.descriptor}
                          </p>
                          {lvl.behavioral_indicators.length > 0 && (
                            <ul className="list-disc pl-3.5 space-y-0.5">
                              {lvl.behavioral_indicators.map((ind, k) => (
                                <li key={k} className="text-[10px] text-muted-foreground/80">
                                  {ind}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
