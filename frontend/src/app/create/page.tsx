"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Trash2, Upload, FileText, Link, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PipelineProgress } from "@/components/pipeline-progress";
import { ResultsView } from "@/components/results-view";
import { GuidedTour } from "@/components/guided-tour";
import { type ArtifactTabsHandle } from "@/components/artifact-tabs";
import { generateCustom, editArtifact, saveProgram, getExportUrl } from "@/lib/api";
import type { CertOpsOutput, ArtifactKey } from "@/lib/types";

type Status = "idle" | "generating" | "done" | "error" | "replaying" | "saving";

function buildTourSteps(tabsRef: React.RefObject<ArtifactTabsHandle | null>) {
  return [
    {
      target: "[data-tour='summary-card']",
      title: "Program Summary",
      content:
        "Your custom certification program has been generated from your uploaded content. Here's the high-level snapshot.",
      placement: "bottom" as const,
    },
    {
      target: "[data-tour='artifact-tabs']",
      title: "Explore Each Artifact",
      content:
        "Six artifacts were generated from your content. Click any tab to dive into the details.",
      placement: "top" as const,
    },
    {
      target: "[data-tour='edit-button']",
      title: "Edit Any Artifact",
      content:
        "See something you want to change? Click Edit, pick a section, and modify it through form fields. CertOps Studio regenerates downstream artifacts automatically.",
      placement: "bottom" as const,
    },
    {
      target: "[data-tour='actions']",
      title: "Save Your Program",
      content:
        "When you're happy with the results, save your program to access it later from the Saved Programs page.",
      placement: "top" as const,
    },
  ];
}

export default function CreatePage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [urls, setUrls] = useState<string[]>([""]);
  const [files, setFiles] = useState<File[]>([]);
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const tourSteps = buildTourSteps(tabsRef);

  function addUrl() {
    setUrls((prev) => [...prev, ""]);
  }

  function removeUrl(index: number) {
    setUrls((prev) => prev.filter((_, i) => i !== index));
  }

  function updateUrl(index: number, value: string) {
    setUrls((prev) => prev.map((u, i) => (i === index ? value : u)));
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files;
    if (!selected) return;
    setFiles((prev) => [...prev, ...Array.from(selected)]);
    e.target.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const dropped = e.dataTransfer.files;
    if (!dropped.length) return;
    const accepted = Array.from(dropped).filter((f) => {
      const ext = f.name.toLowerCase();
      return ext.endsWith(".pdf") || ext.endsWith(".docx") || ext.endsWith(".txt");
    });
    setFiles((prev) => [...prev, ...accepted]);
  }

  const validUrls = urls.filter((u) => u.trim().length > 0);
  const canSubmit = name.trim() && description.trim() && (validUrls.length > 0 || files.length > 0);

  function startGenerate() {
    if (!canSubmit) return;
    setStatus("generating");
    setError(null);
    setStep(0);

    stepRef.current = setInterval(() => {
      setStep((prev) => (prev < 6 ? prev + 1 : prev));
    }, 12000);

    generateCustom(name.trim(), description.trim(), validUrls, files)
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
      setError("No active session.");
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
    if (!data) return;
    const programName = saveName.trim() || `${name} — ${new Date().toLocaleDateString()}`;
    setStatus("saving");
    try {
      const saved = await saveProgram(programName, "custom", data);
      setSaveDialogOpen(false);
      setSaveName("");
      setSaveSuccess(saved.id);
      setStatus("done");
    } catch (err) {
      setError(String(err));
      setStatus("done");
    }
  }

  const showResults = (status === "done" || status === "error") && data;

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 max-w-5xl mx-auto">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 block"
          >
            &larr; Back to home
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
        <h1 className="text-3xl font-bold tracking-tight">Build Your Own</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Provide your source material and CertOps Studio will generate a complete
          certification package.
        </p>
      </header>

      {!data && status !== "generating" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 max-w-2xl"
        >
          {/* Program Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Program Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Azure AI Engineer Certification"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Description <span className="text-destructive">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the target audience and what this certification should cover..."
              rows={4}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y min-h-[100px]"
            />
          </div>

          <Separator />

          {/* URLs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <Link className="h-4 w-4 text-muted-foreground" />
                Source URLs
              </label>
              <Button
                size="sm"
                variant="ghost"
                onClick={addUrl}
                className="text-xs"
              >
                <Plus className="h-3 w-3 mr-1" /> Add URL
              </Button>
            </div>
            <div className="space-y-2">
              {urls.map((url, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => updateUrl(i, e.target.value)}
                    placeholder="https://learn.microsoft.com/..."
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {urls.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeUrl(i)}
                      className="text-muted-foreground hover:text-destructive px-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <Upload className="h-4 w-4 text-muted-foreground" />
              Upload Files
              <span className="text-xs text-muted-foreground font-normal">
                (PDF, DOCX)
              </span>
            </label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <Upload className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Drag and drop files here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Accepts PDF, DOCX, and TXT files
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {files.length > 0 && (
              <div className="space-y-1">
                {files.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({(file.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      className="text-muted-foreground hover:text-destructive ml-2 shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button
            size="lg"
            onClick={startGenerate}
            disabled={!canSubmit}
            className="w-full"
          >
            Generate Certification
          </Button>

          {!canSubmit && name.trim() && description.trim() && (
            <p className="text-xs text-muted-foreground text-center">
              Add at least one URL or upload a file to continue.
            </p>
          )}
        </motion.div>
      )}

      {(status === "generating" || (data && status !== "idle")) && (
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
                          "Processing your uploaded content...",
                          "Extracting key topics and themes...",
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
                      Only the affected artifacts are regenerating.
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
                        placeholder={`${name} — ${new Date().toLocaleDateString()}`}
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
                    trackName={name}
                    actions={
                      <>
                        {data.thread_id && (
                          <>
                            <Button
                              size="lg"
                              onClick={() =>
                                window.open(
                                  getExportUrl(data.thread_id!),
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
                                const a = document.createElement("a");
                                a.href = getExportUrl(data.thread_id!);
                                a.download = `${name.trim().replace(/\s+/g, "_")}_report.html`;
                                a.click();
                              }}
                              className="flex-1"
                            >
                              Download Report
                            </Button>
                          </>
                        )}
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={() => {
                            setSaveDialogOpen(true);
                            setSaveSuccess(null);
                          }}
                          className="flex-1"
                        >
                          Save Program
                        </Button>
                        <Button
                          variant="ghost"
                          size="lg"
                          onClick={() => {
                            setData(null);
                            setStatus("idle");
                            setStep(0);
                            setError(null);
                            setSaveSuccess(null);
                          }}
                        >
                          Start Over
                        </Button>
                      </>
                    }
                  />

                  {saveSuccess && (
                    <div className="border-t border-border mt-8 pt-6 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Step 1 of 4</span>
                      <Button onClick={() => router.push(`/configure?program=${saveSuccess}`)}>
                        Next: Configure Exam Agent <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
      )}

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
