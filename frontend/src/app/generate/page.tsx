"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PipelineProgress } from "@/components/pipeline-progress";
import { ArtifactTabs, type ArtifactTabsHandle } from "@/components/artifact-tabs";
import { GuidedTour } from "@/components/guided-tour";
import { fetchCached, generateLive, editArtifact, getExportUrl } from "@/lib/api";
import { TRACKS, type CertOpsOutput, type TrackKey, type ArtifactKey } from "@/lib/types";

type Status = "idle" | "loading" | "generating" | "done" | "error" | "replaying";

function buildTourSteps(tabsRef: React.RefObject<ArtifactTabsHandle | null>) {
  return [
    {
      target: "[data-tour='summary-card']",
      title: "Program Summary",
      content:
        "After generation, this card shows a high-level snapshot of your certification program: how many domains, skills, assessments, and items were created, plus the estimated duration.",
      placement: "bottom" as const,
    },
    {
      target: "[data-tour='artifact-tabs']",
      title: "Explore Each Artifact",
      content:
        "Your program is made up of 6 artifacts. Click any tab to dive into the details: the competency framework, learning path, assessments, rubrics, item bank, and blueprint.",
      placement: "top" as const,
    },
    {
      target: "[data-tour='edit-button']",
      title: "Edit Any Artifact",
      content:
        "See something you want to change? Click the Edit button on any tab. You don't need to regenerate the entire program - just edit the part you want. Let's try it.",
      placement: "bottom" as const,
      action: () => tabsRef.current?.openPicker("competency_framework"),
    },
    {
      target: "[data-tour='section-picker']",
      title: "Choose a Section",
      content:
        "Here's the drill-down picker. Each domain is shown as a separate card. Instead of scrolling through the entire framework, just click the section you want to edit. Let's pick the first domain.",
      placement: "top" as const,
      action: () => tabsRef.current?.selectSection("competency_framework", 1),
    },
    {
      target: "[data-tour='form-editor']",
      title: "Edit With Form Fields",
      content:
        "Change a domain name, update a skill description, or add a new behavioral indicator. When you're done, click 'Save & Replay' and CertOps regenerates all downstream artifacts automatically.",
      placement: "top" as const,
      action: () => tabsRef.current?.resetView(),
    },
    {
      target: "[data-tour='actions']",
      title: "Export or Regenerate",
      content:
        "When you're happy with the results, click 'View Certification Report' to get a formatted HTML report. Or click 'Regenerate' to start fresh with a new pipeline run.",
      placement: "top" as const,
    },
  ];
}

function GenerateContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const trackKey = (searchParams.get("track") ?? "ai_champion") as TrackKey;
  const track = TRACKS.find((t) => t.key === trackKey) ?? TRACKS[0];

  const [status, setStatus] = useState<Status>("idle");
  const [data, setData] = useState<CertOpsOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [tourOpen, setTourOpen] = useState(false);
  const stepRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tabsRef = useRef<ArtifactTabsHandle | null>(null);
  const tourSteps = buildTourSteps(tabsRef);

  const loadCached = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const result = await fetchCached(track.key);
      setData(result);
      setStatus("done");
      setStep(7);
    } catch {
      setStatus("idle");
    }
  }, [track.key]);

  useEffect(() => {
    loadCached();
  }, [loadCached]);

  function startGenerate() {
    setStatus("generating");
    setError(null);
    setStep(0);

    stepRef.current = setInterval(() => {
      setStep((prev) => (prev < 6 ? prev + 1 : prev));
    }, 12000);

    generateLive(track.name)
      .then((result) => {
        if (stepRef.current) clearInterval(stepRef.current);
        setData(result);
        setStep(7);
        setStatus("done");
      })
      .catch((err) => {
        if (stepRef.current) clearInterval(stepRef.current);
        setError(String(err));
        setStatus("error");
      });
  }

  function handleEdit(artifactKey: ArtifactKey, updatedData: unknown) {
    if (!data?.thread_id) {
      setError("No active session. Generate a certification first.");
      return;
    }

    setStatus("replaying");
    setError(null);

    editArtifact(data.thread_id, artifactKey, updatedData)
      .then((result) => {
        setData(result);
        setStatus("done");
      })
      .catch((err) => {
        setError(String(err));
        setStatus("done");
      });
  }

  function handleDownloadReport() {
    window.open(getExportUrl(track.key), "_blank");
  }

  const totalHours = data?.learning_progression?.objectives?.reduce(
    (sum, o) => sum + (o.estimated_hours ?? 0),
    0
  );

  const showResults = (status === "done" || (status === "idle" && data)) && data;

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 max-w-5xl mx-auto">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 block"
          >
            &larr; Back to tracks
          </button>
          {showResults && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTourOpen(true)}
              className="text-xs"
            >
              Take a Tour
            </Button>
          )}
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          {track.name}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{track.description}</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside>
          <PipelineProgress
            currentStep={step}
            isComplete={status === "done"}
            isError={status === "error"}
          />
          {error && (
            <p className="mt-4 text-xs text-destructive">{error}</p>
          )}
        </aside>

        <main>
          <AnimatePresence mode="wait">
            {status === "loading" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center py-20"
              >
                <p className="text-sm text-muted-foreground animate-pulse">
                  Loading cached results...
                </p>
              </motion.div>
            )}

            {status === "idle" && !data && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center gap-4 py-20"
              >
                <p className="text-sm text-muted-foreground">
                  No cached results available.
                </p>
                <Button onClick={startGenerate}>Generate Certification</Button>
              </motion.div>
            )}

            {status === "generating" && (
              <motion.div
                key="generating"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center py-20"
              >
                <div className="text-center space-y-2">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={step}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.25 }}
                      className="text-sm font-medium"
                    >
                      {[
                        "Retrieving relevant documentation from Qdrant...",
                        "Reranking results with Cohere...",
                        "Generating competency framework...",
                        "Building learning progression...",
                        "Designing assessment tasks...",
                        "Creating scoring rubrics...",
                        "Assembling item bank and blueprint...",
                      ][step] ?? "Finishing up..."}
                    </motion.p>
                  </AnimatePresence>
                  <p className="text-xs text-muted-foreground">
                    This takes 60-90 seconds. Each step uses GPT-4o with
                    structured output.
                  </p>
                </div>
              </motion.div>
            )}

            {status === "replaying" && (
              <motion.div
                key="replaying"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center py-20"
              >
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium animate-pulse">
                    Replaying downstream artifacts...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Only the affected artifacts are regenerating. This is faster
                    than a full run.
                  </p>
                </div>
              </motion.div>
            )}

            {showResults && (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-6"
              >
                {/* Summary stats */}
                <Card data-tour="summary-card" className="border-primary/20">
                  <CardContent className="pt-6 space-y-4">
                    <h2 className="text-xl font-semibold">
                      {data.blueprint?.program_title ?? track.name}
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
                            0
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

                {/* Artifact tabs with edit support */}
                <div data-tour="artifact-tabs">
                  <ArtifactTabs
                    ref={tabsRef}
                    data={data}
                    onEdit={data.thread_id ? handleEdit : undefined}
                  />
                </div>

                {/* Actions */}
                <Separator />
                <div data-tour="actions" className="flex flex-col sm:flex-row gap-3">
                  <Button size="lg" onClick={handleDownloadReport} className="flex-1">
                    View Certification Report
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={startGenerate}
                  >
                    Regenerate
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      <GuidedTour
        steps={tourSteps}
        isOpen={tourOpen}
        onClose={() => {
          setTourOpen(false);
          tabsRef.current?.resetView();
        }}
      />
    </div>
  );
}

export default function GeneratePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-muted-foreground animate-pulse">
            Loading...
          </p>
        </div>
      }
    >
      <GenerateContent />
    </Suspense>
  );
}
