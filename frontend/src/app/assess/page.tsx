"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ExamChat } from "@/components/exam-chat";
import { ExamProgressBar } from "@/components/exam-progress";
import { ExamResultsCard } from "@/components/exam-results";
import { listPrograms, startExam, respondExam } from "@/lib/api";
import type { SavedProgramSummary, ExamSnapshot, ExamMessage, ExamProgress } from "@/lib/types";

type Phase = "setup" | "loading" | "exam" | "complete";

function AssessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const programParam = searchParams.get("program");

  const [programs, setPrograms] = useState<SavedProgramSummary[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [selectedProgram, setSelectedProgram] = useState<string>("");
  const [learnerName, setLearnerName] = useState("");

  const [phase, setPhase] = useState<Phase>("setup");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ExamMessage[]>([]);
  const [progress, setProgress] = useState<ExamProgress>({
    items_completed: 0,
    total_items: 0,
    domain_proficiency: {},
  });
  const [result, setResult] = useState<ExamSnapshot["result"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [currentChoices, setCurrentChoices] = useState<string[] | null>(null);

  const loadPrograms = useCallback(async () => {
    setLoadingPrograms(true);
    try {
      const list = await listPrograms();
      setPrograms(list);
    } catch {
      setError("Failed to load saved programs.");
    } finally {
      setLoadingPrograms(false);
    }
  }, []);

  useEffect(() => {
    loadPrograms();
  }, [loadPrograms]);

  useEffect(() => {
    if (programParam && programs.length > 0 && !selectedProgram) {
      const match = programs.find((p) => p.id === programParam);
      if (match) setSelectedProgram(match.id);
    }
  }, [programParam, programs, selectedProgram]);

  function applySnapshot(snapshot: ExamSnapshot) {
    setThreadId(snapshot.thread_id);

    let msgs = [...snapshot.messages];
    if (snapshot.interrupt?.content && snapshot.status === "awaiting_response") {
      const alreadyShown = msgs.some(
        (m) => m.role === "agent" && m.content === snapshot.interrupt!.content,
      );
      if (!alreadyShown) {
        msgs = [...msgs, { role: "agent" as const, content: snapshot.interrupt.content }];
      }
    }
    setMessages(msgs);
    setProgress(snapshot.progress);

    if (snapshot.status === "complete") {
      setResult(snapshot.result);
      setPhase("complete");
      setCurrentChoices(null);
    } else {
      setPhase("exam");
      const choices = (snapshot.interrupt as Record<string, unknown>)?.choices as string[] | null;
      setCurrentChoices(choices ?? null);
    }
  }

  async function handleStart() {
    if (!selectedProgram || !learnerName.trim()) return;
    setPhase("loading");
    setError(null);
    try {
      const snapshot = await startExam(selectedProgram, learnerName.trim());
      applySnapshot(snapshot);
    } catch (err) {
      setError(String(err));
      setPhase("setup");
    }
  }

  async function handleSend(overrideText?: string) {
    const text = (overrideText ?? inputValue).trim();
    if (!text || !threadId || sending) return;
    setInputValue("");
    setSending(true);
    setCurrentChoices(null);
    setMessages((prev) => [...prev, { role: "learner", content: text }]);
    try {
      const snapshot = await respondExam(threadId, text);
      applySnapshot(snapshot);
    } catch (err) {
      setError(String(err));
    } finally {
      setSending(false);
    }
  }

  function handleReset() {
    setPhase("setup");
    setThreadId(null);
    setMessages([]);
    setProgress({ items_completed: 0, total_items: 0, domain_proficiency: {} });
    setResult(null);
    setError(null);
    setInputValue("");
    setCurrentChoices(null);
  }

  const selectedProgramName = programs.find((p) => p.id === selectedProgram)?.name ?? "";

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 max-w-5xl mx-auto">
      <header className="mb-8">
        <button
          onClick={() => router.push("/")}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 block"
        >
          &larr; Back to home
        </button>
        <h1 className="text-3xl font-bold tracking-tight">Adaptive Exam</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Take an adaptive certification exam powered by AI evaluation.
        </p>
      </header>

      {error && (
        <p className="mb-4 text-xs text-destructive">{error}</p>
      )}

      <AnimatePresence mode="wait">
        {phase === "setup" && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6 max-w-lg"
          >
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Your Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={learnerName}
                onChange={(e) => setLearnerName(e.target.value)}
                placeholder="e.g., Jane Smith"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Certification Program <span className="text-destructive">*</span>
              </label>
              {loadingPrograms ? (
                <p className="text-xs text-muted-foreground animate-pulse">
                  Loading programs...
                </p>
              ) : programs.length === 0 ? (
                <div className="rounded-lg border border-border p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    No saved programs yet. Build one first.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => router.push("/create")}
                  >
                    Build Your Own
                  </Button>
                </div>
              ) : (
                <div className="grid gap-2">
                  {programs.map((p) => (
                    <Card
                      key={p.id}
                      className={`cursor-pointer transition-all ${
                        selectedProgram === p.id
                          ? "border-primary ring-1 ring-primary"
                          : "border-border/50 hover:border-primary/50"
                      }`}
                      onClick={() => setSelectedProgram(p.id)}
                    >
                      <CardHeader className="py-3 px-4">
                        <CardTitle className="text-sm">{p.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {p.domain_count} domains &middot; {p.skill_count} skills
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <Button
              size="lg"
              onClick={handleStart}
              disabled={!selectedProgram || !learnerName.trim()}
              className="w-full"
            >
              Start Exam
            </Button>
          </motion.div>
        )}

        {phase === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center py-20"
          >
            <div className="text-center space-y-2">
              <p className="text-sm font-medium animate-pulse">
                Preparing your exam...
              </p>
              <p className="text-xs text-muted-foreground">
                Loading {selectedProgramName} and selecting your first question.
              </p>
            </div>
          </motion.div>
        )}

        {(phase === "exam" || phase === "complete") && (
          <motion.div
            key="active"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid gap-6 lg:grid-cols-[240px_1fr] max-w-full overflow-hidden"
          >
            <aside className="space-y-4">
              <Card>
                <CardContent className="pt-4">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    Progress
                  </h3>
                  <ExamProgressBar progress={progress} />
                </CardContent>
              </Card>
              <div className="text-xs text-muted-foreground">
                <p className="font-medium">{selectedProgramName}</p>
                <p>Learner: {learnerName}</p>
              </div>
            </aside>

            <main className="min-h-[500px] min-w-0 flex flex-col">
              {phase === "complete" && result ? (
                <div className="space-y-6">
                  <ExamResultsCard result={result} />
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" onClick={handleReset}>
                      Take Another Exam
                    </Button>
                    <Button variant="outline" onClick={() => router.push("/")}>
                      Back to Home
                    </Button>
                    <Button onClick={() => router.push("/saved")}>
                      Next: Deploy &amp; Share <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <ExamChat
                  messages={messages}
                  inputValue={inputValue}
                  onInputChange={setInputValue}
                  onSend={() => handleSend()}
                  onChoiceSelect={(letter) => handleSend(letter)}
                  choices={currentChoices}
                  disabled={sending || phase === "complete"}
                  placeholder={
                    sending
                      ? "Evaluating your response..."
                      : currentChoices
                        ? "Click a choice above, or type the letter..."
                        : "Type your response and press Enter..."
                  }
                />
              )}
            </main>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AssessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      }
    >
      <AssessContent />
    </Suspense>
  );
}
