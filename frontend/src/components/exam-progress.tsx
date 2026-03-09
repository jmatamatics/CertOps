"use client";

import type { ExamProgress } from "@/lib/types";

const LEVEL_COLORS: Record<string, string> = {
  untested: "bg-muted",
  novice: "bg-red-500",
  competent: "bg-amber-500",
  expert: "bg-green-500",
};

interface ExamProgressBarProps {
  progress: ExamProgress;
}

export function ExamProgressBar({ progress }: ExamProgressBarProps) {
  const domains = Object.entries(progress.domain_proficiency);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {progress.items_completed} of {progress.total_items} items
        </span>
        <span>
          {Math.round((progress.items_completed / Math.max(progress.total_items, 1)) * 100)}%
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{
            width: `${(progress.items_completed / Math.max(progress.total_items, 1)) * 100}%`,
          }}
        />
      </div>

      {domains.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Domain Proficiency
          </h4>
          {domains.map(([domain, prof]) => (
            <div key={domain} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs truncate max-w-[160px]">{domain}</span>
                <span className="text-[10px] text-muted-foreground capitalize">
                  {prof.level}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${LEVEL_COLORS[prof.level] ?? "bg-muted"}`}
                  style={{ width: `${(prof.score / 3) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
