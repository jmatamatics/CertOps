"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ResultsView } from "@/components/results-view";
import { GuidedTour } from "@/components/guided-tour";
import { type ArtifactTabsHandle } from "@/components/artifact-tabs";
import { getExportUrl } from "@/lib/api";
import type { CertOpsOutput } from "@/lib/types";

const EXEMPLARS = [
  {
    key: "ai_champion",
    name: "AI Champion",
    description:
      "Copilot Studio agent creation, conversational design, integrations, and governance.",
    file: "/data/certops_ai_champion_output.json",
  },
  {
    key: "user",
    name: "M365 Copilot User",
    description:
      "Copilot across Word, Excel, PowerPoint, Teams, and Outlook — productivity and prompting.",
    file: "/data/certops_user_output.json",
  },
];

function buildTourSteps(
  tabsRef: React.RefObject<ArtifactTabsHandle | null>,
  trackKey: string,
) {
  return [
    {
      target: "[data-tour='summary-card']",
      title: "Program Summary",
      content:
        "This card shows a high-level snapshot of the certification: domains, skills, assessments, items, and estimated duration.",
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
        "When you build your own program, each tab has an Edit button. You can drill into a specific section and change it using form fields — no JSON editing needed. CertOps Studio then regenerates all downstream artifacts automatically.",
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
      title: "View the Final Report",
      content:
        "This is the finished product — a formatted HTML certification report ready to share with stakeholders. Let's open it now so you can see the final deliverable.",
      placement: "top" as const,
      action: () => window.open(getExportUrl(trackKey), "_blank"),
    },
  ];
}

export default function ExemplarPage() {
  const router = useRouter();
  const [selectedExemplar, setSelectedExemplar] = useState<
    (typeof EXEMPLARS)[number] | null
  >(null);
  const [data, setData] = useState<CertOpsOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const tourShownRef = useRef(false);
  const tabsRef = useRef<ArtifactTabsHandle | null>(null);
  const tourSteps = buildTourSteps(
    tabsRef,
    selectedExemplar?.key ?? "ai_champion",
  );

  const loadExemplar = useCallback(async (file: string) => {
    setLoading(true);
    try {
      const res = await fetch(file);
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
    if (selectedExemplar) {
      tourShownRef.current = false;
      loadExemplar(selectedExemplar.file);
    }
  }, [selectedExemplar, loadExemplar]);

  useEffect(() => {
    if (data && !tourShownRef.current) {
      tourShownRef.current = true;
      const timer = setTimeout(() => setTourOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, [data]);

  function handleSelect(exemplar: (typeof EXEMPLARS)[number]) {
    setSelectedExemplar(exemplar);
    setData(null);
  }

  if (!selectedExemplar) {
    return (
      <div className="min-h-screen px-4 py-8 md:px-8 max-w-3xl mx-auto">
        <header className="mb-8">
          <button
            onClick={() => router.push("/")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 block"
          >
            &larr; Back to home
          </button>
          <h1 className="text-3xl font-bold tracking-tight">
            Explore Exemplar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choose a pre-built certification to explore with a guided
            walkthrough.
          </p>
        </header>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="grid gap-6 md:grid-cols-2"
        >
          {EXEMPLARS.map((exemplar, i) => (
            <motion.div
              key={exemplar.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i, duration: 0.4 }}
            >
              <Card
                className="group cursor-pointer border-border/50 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
                onClick={() => handleSelect(exemplar)}
              >
                <CardHeader className="space-y-3">
                  <CardTitle className="text-xl group-hover:text-primary transition-colors">
                    {exemplar.name}
                  </CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {exemplar.description}
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
              setSelectedExemplar(null);
              setData(null);
              setTourOpen(false);
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 block"
          >
            &larr; Choose another exemplar
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
        <h1 className="text-3xl font-bold tracking-tight">
          {selectedExemplar.name}
        </h1>
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
              trackName={selectedExemplar.name}
              actions={
                <Button
                  size="lg"
                  onClick={() =>
                    window.open(
                      getExportUrl(selectedExemplar.key),
                      "_blank",
                    )
                  }
                  className="flex-1"
                >
                  View Certification Report
                </Button>
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
