"use client";

import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ItemBankEntry } from "@/lib/types";

interface ItemBankViewProps {
  items: ItemBankEntry[];
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  hard: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function ItemBankView({ items }: ItemBankViewProps) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 * i }}
        >
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-start gap-3 p-4 pb-2">
              <div className="flex gap-1.5 shrink-0">
                <Badge
                  variant="outline"
                  className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                >
                  {item.task_type}
                </Badge>
                <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20">
                  {item.competency_ref}
                </Badge>
                {item.difficulty && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${DIFFICULTY_COLORS[item.difficulty] ?? ""}`}
                  >
                    {item.difficulty}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              <CardTitle className="text-sm leading-snug">
                {item.stem}
              </CardTitle>
              <Separator />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
                  Expected Response
                </p>
                <p className="text-xs text-muted-foreground">{item.expected_response_summary}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
                  Scoring Notes
                </p>
                <p className="text-xs text-muted-foreground">{item.scoring_notes}</p>
              </div>
              {item.model_answer && (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
                    Model Answer
                  </p>
                  <div className="rounded-r-md border-l-[3px] border-blue-500 bg-muted/50 p-3 text-xs whitespace-pre-wrap">
                    {item.model_answer}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
