"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PipelineProgress } from "@/components/pipeline-progress";
import { fetchCached, generateLive, getExportUrl } from "@/lib/api";
import { TRACKS, type CertOpsOutput, type TrackKey } from "@/lib/types";

type Status = "idle" | "loading" | "generating" | "done" | "error";

function GenerateContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const trackKey = (searchParams.get("track") ?? "ai_champion") as TrackKey;
  const track = TRACKS.find((t) => t.key === trackKey) ?? TRACKS[0];

  const [status, setStatus] = useState<Status>("idle");
  const [data, setData] = useState<CertOpsOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const stepRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  function handleDownloadReport() {
    window.open(getExportUrl(track.key), "_blank");
  }

  const totalHours = data?.learning_progression?.objectives?.reduce(
    (sum, o) => sum + (o.estimated_hours ?? 0),
    0
  );

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 max-w-4xl mx-auto">
      <header className="mb-8">
        <button
          onClick={() => router.push("/")}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 block"
        >
          &larr; Back to tracks
        </button>
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

            {(status === "done" || (status === "idle" && data)) && data && (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-6"
              >
                {/* Blueprint summary */}
                {data.blueprint && (
                  <Card className="border-primary/20">
                    <CardContent className="pt-6 space-y-4">
                      <h2 className="text-xl font-semibold">
                        {data.blueprint.program_title}
                      </h2>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {data.blueprint.program_overview}
                      </p>

                      <Separator />

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
                )}

                {/* Domains list */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    Domain Coverage
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {data.competency_framework.domains.map((domain) => (
                      <Card key={domain.name} className="border-border/50">
                        <CardContent className="py-3 px-4">
                          <div className="font-medium text-sm">{domain.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {domain.skills.length} skills &middot;{" "}
                            {domain.skills
                              .map((s) => s.name)
                              .join(", ")}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Download actions */}
                <Separator />

                <div className="flex flex-col sm:flex-row gap-3">
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
