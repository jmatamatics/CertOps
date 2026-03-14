"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { AgentConfigurator } from "@/components/agent-configurator";
import { listPrograms, getProgram } from "@/lib/api";
import type { SavedProgramSummary } from "@/lib/types";

function ConfigureContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const programIdParam = searchParams.get("program");

  const [programs, setPrograms] = useState<SavedProgramSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState("");

  useEffect(() => {
    if (programIdParam && programIdParam !== selectedId) {
      setSelectedId(programIdParam);
    }
  }, [programIdParam, selectedId]);

  useEffect(() => {
    async function load() {
      try {
        const list = await listPrograms();
        setPrograms(list);

        if (selectedId) {
          const match = list.find((p) => p.id === selectedId);
          if (match) {
            setSelectedName(match.name);
          } else {
            try {
              const full = await getProgram(selectedId);
              setSelectedName(full.name);
            } catch {
              setSelectedId(null);
            }
          }
        }
      } catch {
        /* backend offline */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selectedId]);

  function selectProgram(id: string, name: string) {
    setSelectedId(id);
    setSelectedName(name);
    router.replace(`/configure?program=${id}`);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <motion.div
          className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center gap-3"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Button>
          {selectedId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedId(null);
                setSelectedName("");
                router.replace("/configure");
              }}
            >
              <Settings2 className="h-4 w-4" />
              All Programs
            </Button>
          )}
        </motion.div>

        {!selectedId ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="mb-8 text-center">
              <Settings2 className="mx-auto mb-4 h-12 w-12 text-primary/60" />
              <h1 className="text-3xl font-bold tracking-tight">
                Configure Exam Agent
              </h1>
              <p className="mt-2 text-muted-foreground">
                Select a program to customize its exam agent&apos;s behavior, prompts,
                and scoring thresholds.
              </p>
            </div>

            {programs.length === 0 ? (
              <Card className="text-center">
                <CardContent className="py-12">
                  <p className="text-muted-foreground">
                    No saved programs found. Create a certification program first, then come back to configure its exam agent.
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => router.push("/create")}
                  >
                    Build a Program
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {programs.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.4 }}
                  >
                    <Card
                      className="cursor-pointer border-border/50 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
                      onClick={() => selectProgram(p.id, p.name)}
                    >
                      <CardHeader>
                        <CardTitle className="text-lg">{p.name}</CardTitle>
                        <CardDescription>
                          {p.domain_count} domains &middot; {p.skill_count} skills
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <div>
            <AgentConfigurator programId={selectedId} programName={selectedName} />

            <div className="border-t border-border mt-8 pt-6 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Step 2 of 4</span>
              <Button onClick={() => router.push(`/assess?program=${selectedId}`)}>
                Next: Test Your Exam <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ConfigurePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      }
    >
      <ConfigureContent />
    </Suspense>
  );
}
