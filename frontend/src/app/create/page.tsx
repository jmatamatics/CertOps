"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PipelineProgress } from "@/components/pipeline-progress";
import { ResultsView } from "@/components/results-view";
import { GuidedTour } from "@/components/guided-tour";
import { type ArtifactTabsHandle } from "@/components/artifact-tabs";
import {
  fetchCached,
  generateLive,
  editArtifact,
  getExportUrl,
  saveProgram,
} from "@/lib/api";
import {
  TRACKS,
  type CertOpsOutput,
  type TrackInfo,
  type ArtifactKey,
} from "@/lib/types";

type Status = "idle" | "loading" | "generating" | "done" | "error" | "replaying" | "saving";

function buildTourSteps(tabsRef: React.RefObject<ArtifactTabsHandle | null>) {
  return [
    {
      target: "[data-tour='summary-card']",
      title: "Program Summary",
      content:
        "After generation, this card shows a high-level snapshot of your certification program: domains, skills, assessments, items, and estimated duration.",
      placement: "bottom" as const,
    },
    {
      target: "[data-tour='artifact-tabs']",
      title: "Explore Each Artifact",
      content:
        "Your program is made up of 6 artifacts. Click any tab to dive into the details: competency framework, learning path, assessments, rubrics, item bank, and blueprint.",
      placement: "top" as const,
    },
    {
      target: "[data-tour='edit-button']",
      title: "Edit Any Artifact",
      content:
        "See something you want to change? Click the Edit button on any tab. You don't need to regenerate the entire program — just edit the part you want. Let's try it.",
      placement: "bottom" as const,
      action: () => tabsRef.current?.openPicker("competency_framework"),
    },
    {
      target: "[data-tour='section-picker']",
      title: "Choose a Section",
      content:
        "Here's the drill-down picker. Each domain is shown as a separate card. Instead of scrolling through the entire framework, just click the section you want to edit.",
      placement: "top" as const,
      action: () => tabsRef.current?.selectSection("competency_framework", 1),
    },
    {
      target: "[data-tour='form-editor']",
      title: "Edit With Form Fields",
      content:
        "Change a domain name, update a skill description, or add a new behavioral indicator. When done, click 'Save & Replay' and CertOps regenerates all downstream artifacts automatically.",
      placement: "top" as const,
      action: () => tabsRef.current?.resetView(),
    },
    {
      target: "[data-tour='actions']",
      title: "Export, Save, or Regenerate",
      content:
        "View a formatted report, save your program for later, or regenerate from scratch.",
      placement: "top" as const,
    },
  ];
}

export default function CreatePage() {
  const router = useRouter();

  const [selectedTrack, setSelectedTrack] = useState<TrackInfo | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [data, setData] = useState<CertOpsOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [tourOpen, setTourOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const stepRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tabsRef = useRef<ArtifactTabsHandle | null>(null);
  const tourSteps = buildTourSteps(tabsRef);

  const loadCached = useCallback(async () => {
    if (!selectedTrack) return;
    setStatus("loading");
    setError(null);
    try {
      const result = await fetchCached(selectedTrack.key);
      setData(result);
      setStatus("done");
      setStep(7);
    } catch {
      setStatus("idle");
    }
  }, [selectedTrack]);

  useEffect(() => {
    if (selectedTrack) loadCached();
  }, [selectedTrack, loadCached]);

  function startGenerate() {
    if (!selectedTrack) return;
    setStatus("generating");
    setError(null);
    setStep(0);

    stepRef.current = setInterval(() => {
      setStep((prev) => (prev < 6 ? prev + 1 : prev));
    }, 12000);

    generateLive(selectedTrack.name)
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

  async function handleSave() {
    if (!selectedTrack || !data) return;
    const name = saveName.trim() || `${selectedTrack.name} — ${new Date().toLocaleDateString()}`;
    setStatus("saving");
    try {
      const saved = await saveProgram(name, selectedTrack.key, data);
      setSaveDialogOpen(false);
      setSaveName("");
      setSaveSuccess(saved.id);
      setStatus("done");
    } catch (err) {
      setError(String(err));
      setStatus("done");
    }
  }

  const showResults = (status === "done" || (status === "idle" && data)) && data;

  if (!selectedTrack) {
    return (
      <div className="min-h-screen px-4 py-8 md:px-8 max-w-3xl mx-auto">
        <header className="mb-8">
          <button
            onClick={() => router.push("/")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 block"
          >
            &larr; Back to home
          </button>
          <h1 className="text-3xl font-bold tracking-tight">Build Your Own</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select a certification track to generate a complete package.
          </p>
        </header>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="grid gap-6 md:grid-cols-2"
        >
          {TRACKS.map((track, i) => (
            <motion.div
              key={track.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i, duration: 0.4 }}
            >
              <Card
                className="group cursor-pointer border-border/50 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
                onClick={() => setSelectedTrack(track)}
              >
                <CardHeader className="space-y-3">
                  <CardTitle className="text-xl group-hover:text-primary transition-colors">
                    {track.name}
                  </CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {track.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 max-w-5xl mx-auto">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setSelectedTrack(null);
              setData(null);
              setStatus("idle");
              setStep(0);
              setError(null);
              setSaveSuccess(null);
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 block"
          >
            &larr; Change track
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
          {selectedTrack.name}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {selectedTrack.description}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside>
          <PipelineProgress
            currentStep={step}
            isComplete={status === "done"}
            isError={status === "error"}
          />
          {error && <p className="mt-4 text-xs text-destructive">{error}</p>}
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

            {status === "saving" && (
              <motion.div
                key="saving"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center py-20"
              >
                <p className="text-sm text-muted-foreground animate-pulse">
                  Saving program...
                </p>
              </motion.div>
            )}

            {showResults && (
              <motion.div key="done">
                {saveSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400 flex items-center justify-between"
                  >
                    <span>Program saved successfully!</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-green-400 hover:text-green-300"
                      onClick={() => router.push(`/saved/${saveSuccess}`)}
                    >
                      View in Saved Programs
                    </Button>
                  </motion.div>
                )}

                {saveDialogOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 rounded-lg border border-border bg-card px-4 py-4 space-y-3"
                  >
                    <h4 className="text-sm font-medium">Save Program</h4>
                    <input
                      type="text"
                      placeholder={`${selectedTrack.name} — ${new Date().toLocaleDateString()}`}
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSaveDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSave}>
                        Save
                      </Button>
                    </div>
                  </motion.div>
                )}

                <ResultsView
                  ref={tabsRef}
                  data={data}
                  onEdit={data.thread_id ? handleEdit : undefined}
                  trackName={selectedTrack.name}
                  actions={
                    <>
                      <Button
                        size="lg"
                        onClick={() =>
                          window.open(
                            getExportUrl(selectedTrack.key),
                            "_blank",
                          )
                        }
                        className="flex-1"
                      >
                        View Certification Report
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => {
                          setSaveDialogOpen(true);
                          setSaveSuccess(null);
                        }}
                      >
                        Save Program
                      </Button>
                      <Button
                        variant="ghost"
                        size="lg"
                        onClick={startGenerate}
                      >
                        Regenerate
                      </Button>
                    </>
                  }
                />
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
