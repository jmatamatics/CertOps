"use client";

import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ItemBankEntry } from "@/lib/types";

interface ItemBankViewProps {
  items: ItemBankEntry[];
}

const TYPE_COLORS: Record<string, string> = {
  performance: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  scenario: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  analysis: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
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
              <Badge
                variant="outline"
                className={`shrink-0 text-[10px] ${TYPE_COLORS[item.task_type] ?? ""}`}
              >
                {item.task_type}
              </Badge>
              <CardTitle className="text-sm leading-snug">
                {item.stem}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              <Badge variant="outline" className="text-[10px]">
                {item.competency_ref}
              </Badge>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Expected Response
                </p>
                <p className="text-xs">{item.expected_response_summary}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Scoring Notes
                </p>
                <p className="text-xs">{item.scoring_notes}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
