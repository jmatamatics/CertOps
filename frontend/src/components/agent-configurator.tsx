"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  getAgentConfig,
  getAgentConfigDefaults,
  updateAgentConfig,
  resetAgentConfig,
} from "@/lib/api";
import type { AgentConfig, PassThresholds, ScoringScale } from "@/lib/types";
import {
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  MessageSquareText,
  SlidersHorizontal,
  ListChecks,
} from "lucide-react";

interface Props {
  programId: string;
  programName: string;
}

const PROMPT_FIELDS: { key: keyof AgentConfig; label: string; description: string; rows: number }[] = [
  {
    key: "evaluator_system_prompt",
    label: "Evaluator Instructions",
    description: "How the AI evaluates open-ended learner responses.",
    rows: 10,
  },
  {
    key: "result_analyst_prompt",
    label: "Results Summary Style",
    description: "How the AI writes the final exam results narrative.",
    rows: 4,
  },
  {
    key: "welcome_message",
    label: "Welcome Message",
    description: "Optional greeting shown when the exam begins.",
    rows: 3,
  },
  {
    key: "farewell_message",
    label: "Farewell Message",
    description: "Optional closing note appended to the exam results.",
    rows: 3,
  },
];

type Status = "idle" | "saving" | "saved" | "error";

export function AgentConfigurator({ programId, programName }: Props) {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [defaults, setDefaults] = useState<AgentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [cfg, defs] = await Promise.all([
          getAgentConfig(programId),
          getAgentConfigDefaults(),
        ]);
        setConfig(cfg);
        setDefaults(defs);
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Failed to load config");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [programId]);

  const handlePromptChange = useCallback(
    (key: keyof AgentConfig, value: string) => {
      setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
      setStatus("idle");
    },
    [],
  );

  const handleThresholdChange = useCallback(
    (field: keyof PassThresholds, value: number) => {
      setConfig((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pass_thresholds: { ...prev.pass_thresholds, [field]: value },
        };
      });
      setStatus("idle");
    },
    [],
  );

  const handleScaleChange = useCallback(
    (tier: keyof ScoringScale, value: number) => {
      setConfig((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          scoring_scale: {
            ...prev.scoring_scale,
            [tier]: { ...prev.scoring_scale[tier], min_score: value },
          },
        };
      });
      setStatus("idle");
    },
    [],
  );

  const handleIntChange = useCallback(
    (key: "max_exam_items" | "min_items_per_domain", value: number) => {
      setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
      setStatus("idle");
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!config) return;
    setStatus("saving");
    try {
      const updated = await updateAgentConfig(programId, config);
      setConfig(updated);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2500);
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Save failed");
    }
  }, [config, programId]);

  const handleReset = useCallback(async () => {
    setStatus("saving");
    try {
      const reset = await resetAgentConfig(programId);
      setConfig(reset);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2500);
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Reset failed");
    }
  }, [programId]);

  const isModified = config && defaults
    ? JSON.stringify(config) !== JSON.stringify(defaults)
    : false;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <motion.div
          className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
        />
      </div>
    );
  }

  if (errorMsg && !config) {
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Error Loading Configuration
          </CardTitle>
          <CardDescription>{errorMsg}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!config) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Agent Configuration
          </h2>
          <p className="text-muted-foreground mt-1">
            Customize how the exam agent evaluates, scores, and communicates for{" "}
            <span className="text-foreground font-medium">{programName}</span>.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={status === "saving" || !isModified}
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Defaults
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={status === "saving"}
          >
            {status === "saving" ? (
              <motion.div
                className="h-4 w-4 rounded-full border-2 border-white border-t-transparent"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.6, ease: "linear" }}
              />
            ) : status === "saved" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {status === "saved" ? "Saved" : "Save Changes"}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {status === "error" && errorMsg && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main tabs */}
      <Tabs defaultValue="prompts" className="w-full">
        <TabsList>
          <TabsTrigger value="prompts" className="gap-1.5">
            <MessageSquareText className="h-4 w-4" />
            Prompts
          </TabsTrigger>
          <TabsTrigger value="thresholds" className="gap-1.5">
            <SlidersHorizontal className="h-4 w-4" />
            Thresholds
          </TabsTrigger>
          <TabsTrigger value="exam-length" className="gap-1.5">
            <ListChecks className="h-4 w-4" />
            Exam Length
          </TabsTrigger>
        </TabsList>

        {/* Prompts Tab */}
        <TabsContent value="prompts" className="mt-6 space-y-6">
          {PROMPT_FIELDS.map((field) => (
            <Card key={field.key}>
              <CardHeader>
                <CardTitle className="text-base">{field.label}</CardTitle>
                <CardDescription>{field.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <textarea
                  className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y min-h-[80px]"
                  rows={field.rows}
                  value={(config[field.key] as string) ?? ""}
                  onChange={(e) => handlePromptChange(field.key, e.target.value)}
                  placeholder={field.key === "welcome_message" || field.key === "farewell_message" ? "(optional)" : ""}
                />
                {defaults && (config[field.key] as string) !== (defaults[field.key] as string) && (
                  <button
                    className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => handlePromptChange(field.key, defaults[field.key] as string)}
                  >
                    Restore default
                  </button>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Thresholds Tab */}
        <TabsContent value="thresholds" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pass / Fail Thresholds</CardTitle>
              <CardDescription>
                Control when a learner passes or fails the exam.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ThresholdSlider
                label="Overall Minimum Score"
                description="Minimum average score across all domains to pass."
                value={config.pass_thresholds.overall_min}
                min={1.0}
                max={3.0}
                step={0.1}
                onChange={(v) => handleThresholdChange("overall_min", v)}
              />
              <Separator />
              <ThresholdSlider
                label="Domain Minimum Score"
                description="Each domain must meet this score for a clean pass."
                value={config.pass_thresholds.domain_min}
                min={1.0}
                max={3.0}
                step={0.1}
                onChange={(v) => handleThresholdChange("domain_min", v)}
              />
              <Separator />
              <ThresholdSlider
                label="Weak Domain Floor"
                description="Lowest acceptable domain score (below this always fails)."
                value={config.pass_thresholds.weak_domain_floor}
                min={1.0}
                max={3.0}
                step={0.1}
                onChange={(v) => handleThresholdChange("weak_domain_floor", v)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Proficiency Level Boundaries</CardTitle>
              <CardDescription>
                Score thresholds that determine a learner&apos;s proficiency level per domain.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ThresholdSlider
                label="Expert Minimum"
                description="Scores at or above this are classified as expert."
                value={config.scoring_scale.expert.min_score}
                min={1.5}
                max={3.0}
                step={0.1}
                onChange={(v) => handleScaleChange("expert", v)}
              />
              <Separator />
              <ThresholdSlider
                label="Competent Minimum"
                description="Scores at or above this (but below expert) are classified as competent."
                value={config.scoring_scale.competent.min_score}
                min={1.0}
                max={2.5}
                step={0.1}
                onChange={(v) => handleScaleChange("competent", v)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exam Length Tab */}
        <TabsContent value="exam-length" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Exam Length Controls</CardTitle>
              <CardDescription>
                Control how many questions are administered during an exam.
                The agent adaptively selects items from the full item bank up to
                these limits.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ThresholdSlider
                label="Maximum Exam Items"
                description="The most questions a learner will be asked in a single exam session."
                value={config.max_exam_items}
                min={5}
                max={50}
                step={1}
                onChange={(v) => handleIntChange("max_exam_items", Math.round(v))}
              />
              <Separator />
              <ThresholdSlider
                label="Minimum Items Per Domain"
                description="Each domain must have at least this many questions answered before the exam can end."
                value={config.min_items_per_domain}
                min={1}
                max={10}
                step={1}
                onChange={(v) => handleIntChange("min_items_per_domain", Math.round(v))}
              />
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </motion.div>
  );
}


/* ── Reusable slider component ── */

function ThresholdSlider({
  label,
  description,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const isInteger = step >= 1;
  const fmt = (v: number) => (isInteger ? String(Math.round(v)) : v.toFixed(1));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="min-w-[48px] text-right text-lg font-semibold tabular-nums">
          {fmt(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-primary h-2 rounded-full appearance-none bg-muted cursor-pointer"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{fmt(min)}</span>
        <span>{fmt(max)}</span>
      </div>
    </div>
  );
}
