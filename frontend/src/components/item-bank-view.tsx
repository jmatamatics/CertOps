"use client";

import { motion, AnimatePresence } from "motion/react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ItemBankEntry } from "@/lib/types";

interface ItemBankViewProps {
  items: ItemBankEntry[];
  onDeleteItem?: (index: number) => void;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  hard: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function ItemBankView({ items, onDeleteItem }: ItemBankViewProps) {
  return (
    <div className="space-y-3">
      {onDeleteItem && (
        <div className="flex items-center justify-between text-xs text-muted-foreground pb-1 border-b border-border/50">
          <span>{items.length} item{items.length !== 1 ? "s" : ""} in bank</span>
        </div>
      )}
      <AnimatePresence mode="popLayout">
        {items.map((item, i) => (
          <motion.div
            key={`${item.stem.slice(0, 40)}-${item.competency_ref}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -40, height: 0, marginBottom: 0 }}
            transition={{ delay: 0.06 * i }}
            layout
          >
            <Card className="border-border/50 group">
              <CardHeader className="flex flex-row items-start gap-3 p-4 pb-2">
                <div className="flex gap-1.5 shrink-0 flex-1 flex-wrap">
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
                {onDeleteItem && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    onClick={() => onDeleteItem(i)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
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
      </AnimatePresence>
    </div>
  );
}
