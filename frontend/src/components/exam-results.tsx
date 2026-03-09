"use client";

import { motion } from "motion/react";
import { CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ExamResult } from "@/lib/types";

const LEVEL_COLORS: Record<string, string> = {
  novice: "text-red-400",
  competent: "text-amber-400",
  expert: "text-green-400",
  untested: "text-muted-foreground",
};

interface ExamResultsCardProps {
  result: ExamResult;
}

export function ExamResultsCard({ result }: ExamResultsCardProps) {
  const domains = Object.entries(result.domain_breakdown);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className={result.passed ? "border-green-500/40" : "border-red-500/40"}>
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center gap-3">
            {result.passed ? (
              <CheckCircle className="h-8 w-8 text-green-500" />
            ) : (
              <XCircle className="h-8 w-8 text-red-500" />
            )}
            <div>
              <h3 className="text-xl font-bold">
                {result.passed ? "Congratulations — You Passed!" : "Not Yet — Keep Going!"}
              </h3>
              <p className="text-sm text-muted-foreground">
                Overall Score: {result.overall_score.toFixed(2)} / 3.00
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {domains.map(([domain, prof]) => (
              <div
                key={domain}
                className="rounded-lg border border-border p-3 text-center"
              >
                <div className={`text-lg font-bold ${LEVEL_COLORS[prof.level] ?? ""}`}>
                  {prof.score.toFixed(1)}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {domain}
                </div>
                <div className="text-[10px] capitalize text-muted-foreground">
                  {prof.level}
                </div>
              </div>
            ))}
          </div>

          <p className="text-sm leading-relaxed">{result.summary}</p>

          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
            <h4 className="text-sm font-medium mb-1">Recommendation</h4>
            <p className="text-sm text-muted-foreground">{result.recommendation}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
