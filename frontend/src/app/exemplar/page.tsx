"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { ResultsView } from "@/components/results-view";
import { GuidedTour } from "@/components/guided-tour";
import { type ArtifactTabsHandle } from "@/components/artifact-tabs";
import { getExportUrl } from "@/lib/api";
import type { CertOpsOutput } from "@/lib/types";

function buildTourSteps(tabsRef: React.RefObject<ArtifactTabsHandle | null>) {
  return [
    {
      target: "[data-tour='summary-card']",
      title: "Program Summary",
      content:
        "This card shows a high-level snapshot of the AI Champion certification: domains, skills, assessments, items, and estimated duration.",
      placement: "bottom" as const,
    },
    {
      target: "[data-tour='artifact-tabs']",
      title: "Explore Each Artifact",
      content:
        "The program is made up of 6 artifacts. Click any tab to dive into the details: competency framework, learning path, assessments, rubrics, item bank, and blueprint.",
      placement: "top" as const,
    },
    {
      target: "[data-tour='artifact-tabs']",
      title: "Edit Any Artifact",
      content:
        "When you build your own program, each tab has an Edit button. You can drill into a specific section and change it using form fields — no JSON editing needed. CertOps then regenerates all downstream artifacts automatically.",
      placement: "top" as const,
      action: () => tabsRef.current?.openPicker("competency_framework"),
    },
    {
      target: "[data-tour='section-picker']",
      title: "Drill-Down Section Picker",
      content:
        "Here's the section picker. Each domain appears as a card. Instead of scrolling through the whole framework, just pick the section you want to edit. Let's see how a domain looks in the form editor.",
      placement: "top" as const,
      action: () => tabsRef.current?.selectSection("competency_framework", 1),
    },
    {
      target: "[data-tour='form-editor']",
      title: "Form-Based Editing",
      content:
        "Change a domain name, update a skill description, or add a new behavioral indicator — all through clean form fields. When done, 'Save & Replay' regenerates downstream artifacts automatically.",
      placement: "top" as const,
      action: () => tabsRef.current?.resetView(),
    },
    {
      target: "[data-tour='actions']",
      title: "Export Your Report",
      content:
        "Click 'View Certification Report' to get a formatted HTML report you can share with stakeholders. Ready to build your own? Head back to the home page.",
      placement: "top" as const,
    },
  ];
}

export default function ExemplarPage() {
  const router = useRouter();
  const [data, setData] = useState<CertOpsOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [tourOpen, setTourOpen] = useState(false);
  const tabsRef = useRef<ArtifactTabsHandle | null>(null);
  const tourSteps = buildTourSteps(tabsRef);

  const loadExemplar = useCallback(async () => {
    try {
      const res = await fetch("/data/certops_ai_champion_output.json");
      if (!res.ok) throw new Error("Failed to load exemplar data");
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExemplar();
  }, [loadExemplar]);

  useEffect(() => {
    if (data && !tourOpen) {
      const timer = setTimeout(() => setTourOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, [data, tourOpen]);

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
          {data && (
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
        <h1 className="text-3xl font-bold tracking-tight">AI Champion</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Exemplar certification program — explore every artifact with a guided
          walkthrough.
        </p>
      </header>

      <AnimatePresence mode="wait">
        {loading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center py-20"
          >
            <p className="text-sm text-muted-foreground animate-pulse">
              Loading exemplar...
            </p>
          </motion.div>
        )}

        {!loading && !data && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-4 py-20"
          >
            <p className="text-sm text-muted-foreground">
              Could not load exemplar data.
            </p>
          </motion.div>
        )}

        {!loading && data && (
          <motion.div key="results">
            <ResultsView
              ref={tabsRef}
              data={data}
              readOnly
              trackName="AI Champion"
              actions={
                <>
                  <Button
                    size="lg"
                    onClick={() =>
                      window.open(getExportUrl("ai_champion"), "_blank")
                    }
                    className="flex-1"
                  >
                    View Certification Report
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={() => router.push("/create")}
                  >
                    Build Your Own
                  </Button>
                </>
              }
            />
          </motion.div>
        )}
      </AnimatePresence>

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
