"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listPrograms } from "@/lib/api";
import type { SavedProgramSummary } from "@/lib/types";

export default function SavedPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<SavedProgramSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listPrograms();
      setPrograms(list);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 max-w-4xl mx-auto">
      <header className="mb-8">
        <button
          onClick={() => router.push("/")}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 block"
        >
          &larr; Back to home
        </button>
        <h1 className="text-3xl font-bold tracking-tight">Saved Programs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse and manage your published certification programs.
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
              Loading saved programs...
            </p>
          </motion.div>
        )}

        {!loading && error && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-4 py-20"
          >
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" onClick={load}>
              Retry
            </Button>
          </motion.div>
        )}

        {!loading && !error && programs.length === 0 && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-6 py-20 text-center"
          >
            <FolderOpen className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                No saved programs yet
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Build your first certification program and save it here.
              </p>
            </div>
            <Button onClick={() => router.push("/create")}>
              Build Your Own
            </Button>
          </motion.div>
        )}

        {!loading && !error && programs.length > 0 && (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-4 md:grid-cols-2"
          >
            {programs.map((program, i) => (
              <motion.div
                key={program.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.3 }}
              >
                <Card
                  className="group cursor-pointer border-border/50 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
                  onClick={() => router.push(`/saved/${program.id}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">
                        {program.name}
                      </CardTitle>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {program.track_key === "ai_champion"
                          ? "AI Champion"
                          : program.track_key === "user"
                            ? "M365 Copilot"
                            : program.track_key}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Created{" "}
                      {new Date(program.created_at).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        },
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>
                        <span className="font-medium text-foreground">
                          {program.domain_count}
                        </span>{" "}
                        domains
                      </span>
                      <span>
                        <span className="font-medium text-foreground">
                          {program.skill_count}
                        </span>{" "}
                        skills
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
