"use client";

import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { CertificationBlueprint } from "@/lib/types";

interface BlueprintViewProps {
  blueprint: CertificationBlueprint;
}

export function BlueprintView({ blueprint }: BlueprintViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">{blueprint.program_title}</h3>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Audience:</span>{" "}
          {blueprint.target_audience}
        </p>
      </div>

      {/* Quick stats */}
      <div className="flex gap-3">
        <Badge variant="secondary" className="text-xs">
          {blueprint.estimated_duration_hours}h estimated
        </Badge>
        <Badge variant="outline" className="text-xs">
          {blueprint.domain_summary.length} domains
        </Badge>
      </div>

      {/* Program Overview */}
      <Card className="border-border/50">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Program Overview</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
            {blueprint.program_overview}
          </p>
        </CardContent>
      </Card>

      {/* Prerequisites */}
      {blueprint.prerequisites && (
        <Card className="border-border/50">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Prerequisites</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {blueprint.prerequisites}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Domain Coverage */}
      <Card className="border-border/50">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Domain Coverage</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-2">
          {blueprint.domain_summary.map((summary, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary mt-0.5">
                {i + 1}
              </span>
              <p className="text-xs text-muted-foreground">{summary}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Assessment Strategy */}
      <Card className="border-border/50">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Assessment Strategy</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
            {blueprint.assessment_strategy}
          </p>
        </CardContent>
      </Card>

      {/* Renewal Cadence */}
      <Card className="border-border/50">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Renewal Cadence</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {blueprint.renewal_cadence}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
