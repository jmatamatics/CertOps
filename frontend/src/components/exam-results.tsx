"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, XCircle, ChevronDown, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ExamResult, QuestionReview } from "@/lib/types";

const LEVEL_COLORS: Record<string, string> = {
  novice: "text-red-400",
  competent: "text-amber-400",
  expert: "text-green-400",
  untested: "text-muted-foreground",
};

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 2.5 ? "bg-green-500/15 text-green-400 border-green-500/30"
    : score >= 1.7 ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
    : "bg-red-500/15 text-red-400 border-red-500/30";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${color}`}>
      {score.toFixed(1)}
    </span>
  );
}

function QuestionReviewItem({ item, index }: { item: QuestionReview; index: number }) {
  const [open, setOpen] = useState(false);
  const isMC = item.question_type === "multiple_choice";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="rounded-lg border border-border overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-card/50 transition-colors"
      >
        <span className="text-xs font-medium text-muted-foreground w-6 shrink-0">
          Q{index + 1}
        </span>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.score >= 2.5 ? "bg-green-500" : item.score >= 1.7 ? "bg-amber-500" : "bg-red-500"}`} />
        <span className="text-sm truncate flex-1 min-w-0">{item.stem}</span>
        <span className="text-[10px] uppercase text-muted-foreground shrink-0">
          {isMC ? "MC" : "Open"}{item.difficulty ? ` · ${item.difficulty}` : ""}
        </span>
        <ScoreBadge score={item.score} />
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border/50 break-words overflow-hidden">
              <div className="text-xs text-muted-foreground">{item.domain}</div>

              {item.feedback && (
                <div className="rounded-md bg-primary/5 border border-primary/20 p-3">
                  <h5 className="text-xs font-medium mb-1">Feedback</h5>
                  <p className="text-sm text-muted-foreground">{item.feedback}</p>
                </div>
              )}

              {isMC && item.correct_choice && (
                <div className="text-sm">
                  <span className="text-xs font-medium text-muted-foreground">Correct answer: </span>
                  <span className="font-medium">{item.correct_choice}</span>
                </div>
              )}

              {item.model_answer && (
                <details className="group">
                  <summary className="text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                    Show model answer
                  </summary>
                  <div className="mt-2 prose prose-invert prose-sm max-w-none [&_p]:my-1 text-muted-foreground">
                    <ReactMarkdown>{item.model_answer}</ReactMarkdown>
                  </div>
                </details>
              )}

              {item.source_url && (
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Learn more
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface ExamResultsCardProps {
  result: ExamResult;
}

export function ExamResultsCard({ result }: ExamResultsCardProps) {
  const domains = Object.entries(result.domain_breakdown);
  const review = result.question_review ?? [];
  const [showReview, setShowReview] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6 w-full min-w-0 overflow-hidden"
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

          <div className="grid grid-cols-2 gap-3">
            {domains.map(([domain, prof]) => (
              <div
                key={domain}
                className="rounded-lg border border-border p-3 text-center min-w-0"
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

          <p className="text-sm leading-relaxed break-words">{result.summary}</p>

          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 break-words">
            <h4 className="text-sm font-medium mb-1">Recommendation</h4>
            <p className="text-sm text-muted-foreground">{result.recommendation}</p>
          </div>
        </CardContent>
      </Card>

      {review.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Question Review</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReview(!showReview)}
              className="text-xs"
            >
              {showReview ? "Collapse" : "Expand"} all
            </Button>
          </div>

          <AnimatePresence>
            {showReview && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                {review.map((q, i) => (
                  <QuestionReviewItem key={i} item={q} index={i} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
