"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Trash2,
  Play,
  Download,
  Link2,
  Code2,
  Check,
  Copy,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ResultsView } from "@/components/results-view";
import { type ArtifactTabsHandle } from "@/components/artifact-tabs";
import {
  getProgram,
  deleteProgram,
  getProgramReportUrl,
} from "@/lib/api";
import type { SavedProgram } from "@/lib/types";

const PROD_ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://certops.vercel.app";

function useCopyFeedback() {
  const [copied, setCopied] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(null), 2000);
  }

  return { copied, copy };
}

export default function SavedDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const programId = params.id;

  const [program, setProgram] = useState<SavedProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const tabsRef = useRef<ArtifactTabsHandle | null>(null);
  const { copied, copy } = useCopyFeedback();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await getProgram(programId);
      setProgram(p);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete() {
    if (!program) return;
    try {
      await deleteProgram(program.id);
      router.push("/saved");
    } catch (err) {
      setError(String(err));
    }
  }

  const trackLabel =
    program?.track_key === "ai_champion"
      ? "AI Champion"
      : program?.track_key === "user"
        ? "M365 Copilot User"
        : program?.name ?? program?.track_key ?? "";

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 max-w-5xl mx-auto">
      <header className="mb-8">
        <button
          onClick={() => router.push("/saved")}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 block"
        >
          &larr; Back to saved programs
        </button>
        {program && (
          <>
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold tracking-tight">
                {program.name}
              </h1>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {trackLabel} &middot; Created{" "}
              {new Date(program.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </>
        )}
      </header>

      {error && (
        <p className="mb-4 text-xs text-destructive">{error}</p>
      )}

      {confirmDelete && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 flex items-center justify-between"
        >
          <p className="text-sm text-destructive">
            Delete this program permanently?
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </div>
        </motion.div>
      )}

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
              Loading program...
            </p>
          </motion.div>
        )}

        {!loading && !program && (
          <motion.div
            key="not-found"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-4 py-20"
          >
            <p className="text-sm text-muted-foreground">Program not found.</p>
            <Button variant="outline" onClick={() => router.push("/saved")}>
              Back to Saved Programs
            </Button>
          </motion.div>
        )}

        {!loading && program && (
          <motion.div key="detail" className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardContent className="pt-5 pb-4">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Quick Actions
                </h3>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => router.push(`/assess?program=${program.id}`)}
                    className="gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Take Exam
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = getProgramReportUrl(program.id, true);
                      a.download = "";
                      a.click();
                    }}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Report
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Share & Embed */}
            <Card>
              <CardContent className="pt-5 pb-4 space-y-5">
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Share &amp; Embed
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Share a direct link or embed the exam into your LMS (Skilljar, Docebo, or any platform that supports HTML embeds).
                  </p>
                </div>

                {/* Exam Link */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                    Exam Link
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Share this URL directly with learners or add it as an external link in your LMS course.
                  </p>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={`${PROD_ORIGIN}/assess?program=${program.id}`}
                      className="flex-1 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs font-mono text-muted-foreground select-all focus:outline-none"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 shrink-0"
                      onClick={() =>
                        copy(
                          `${PROD_ORIGIN}/assess?program=${program.id}`,
                          "link",
                        )
                      }
                    >
                      {copied === "link" ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copied === "link" ? "Copied" : "Copy Link"}
                    </Button>
                  </div>
                </div>

                {/* Embed Code */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
                    Embed in Your LMS
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Copy the iframe snippet below and paste it into a custom HTML block or lesson in your LMS. In Skilljar, use Course &rarr; Lesson &rarr; Custom Content.
                  </p>
                  <div className="rounded-md border border-border bg-muted/50 p-3">
                    <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">
{`<iframe
  src="${PROD_ORIGIN}/assess?program=${program.id}"
  width="100%" height="800"
  style="border:none; border-radius:8px;">
</iframe>`}
                    </pre>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() =>
                      copy(
                        `<iframe src="${PROD_ORIGIN}/assess?program=${program.id}" width="100%" height="800" style="border:none; border-radius:8px;"></iframe>`,
                        "embed",
                      )
                    }
                  >
                    {copied === "embed" ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copied === "embed" ? "Copied" : "Copy Embed Code"}
                  </Button>
                </div>

                {/* CSP Notice */}
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 flex gap-2 items-start">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-amber-500">Content Security Policy:</span>{" "}
                    Some platforms (e.g., Workvivo) block iframes from external domains by default.
                    Contact your platform admin to add{" "}
                    <code className="text-xs bg-muted px-1 rounded">{PROD_ORIGIN}</code>{" "}
                    to the allowed sources in the Content Security Policy (CSP).
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Program Artifacts */}
            <ResultsView
              ref={tabsRef}
              data={program.artifacts}
              readOnly
              trackName={trackLabel}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
