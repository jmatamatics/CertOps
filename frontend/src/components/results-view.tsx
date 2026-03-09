"use client";

import { forwardRef } from "react";
import { motion } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArtifactTabs, type ArtifactTabsHandle } from "@/components/artifact-tabs";
import type { CertOpsOutput, ArtifactKey } from "@/lib/types";

interface ResultsViewProps {
  data: CertOpsOutput;
  readOnly?: boolean;
  onEdit?: (key: ArtifactKey, updatedData: unknown) => void;
  trackName?: string;
  actions?: React.ReactNode;
}

export const ResultsView = forwardRef<ArtifactTabsHandle, ResultsViewProps>(
  function ResultsView({ data, readOnly, onEdit, trackName, actions }, ref) {
    const totalHours = data.learning_progression?.objectives?.reduce(
      (sum, o) => sum + (o.estimated_hours ?? 0),
      0,
    );

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        <Card data-tour="summary-card" className="border-primary/20">
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-xl font-semibold">
              {data.blueprint?.program_title ?? trackName ?? "Certification Program"}
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">
                  {data.competency_framework.domains.length}
                </div>
                <div className="text-xs text-muted-foreground">Domains</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">
                  {data.competency_framework.domains.reduce(
                    (sum, d) => sum + d.skills.length,
                    0,
                  )}
                </div>
                <div className="text-xs text-muted-foreground">Skills</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">
                  {data.assessments.length}
                </div>
                <div className="text-xs text-muted-foreground">Assessments</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">
                  {data.item_bank.length}
                </div>
                <div className="text-xs text-muted-foreground">Items</div>
              </div>
            </div>

            {(totalHours ?? 0) > 0 && (
              <>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Estimated Program Duration
                  </span>
                  <span className="font-medium">
                    {totalHours?.toFixed(0)} hours
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div data-tour="artifact-tabs">
          <ArtifactTabs
            ref={ref}
            data={data}
            onEdit={onEdit}
            readOnly={readOnly}
          />
        </div>

        {actions && (
          <>
            <Separator />
            <div data-tour="actions" className="flex flex-col sm:flex-row gap-3">
              {actions}
            </div>
          </>
        )}
      </motion.div>
    );
  },
);
