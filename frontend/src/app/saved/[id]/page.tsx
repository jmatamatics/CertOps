"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResultsView } from "@/components/results-view";
import { type ArtifactTabsHandle } from "@/components/artifact-tabs";
import {
  getProgram,
  updateProgram,
  deleteProgram,
  getExportUrl,
} from "@/lib/api";
import type { SavedProgram, ArtifactKey, CertOpsOutput } from "@/lib/types";

export default function SavedDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const programId = params.id;

  const [program, setProgram] = useState<SavedProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const tabsRef = useRef<ArtifactTabsHandle | null>(null);

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

  function handleEdit(artifactKey: ArtifactKey, updatedData: unknown) {
    if (!program) return;
    const updatedArtifacts = {
      ...program.artifacts,
      [artifactKey]: updatedData,
    } as CertOpsOutput;
    setProgram({ ...program, artifacts: updatedArtifacts });
    setDirty(true);
  }

  async function handleSave() {
    if (!program) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateProgram(program.id, program.artifacts);
      setProgram(updated);
      setDirty(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

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
        : program?.track_key ?? "";

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
              <div className="flex items-center gap-2">
                {dirty && (
                  <span className="text-xs text-amber-400">Unsaved changes</span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
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
          <motion.div key="detail">
            <ResultsView
              ref={tabsRef}
              data={program.artifacts}
              onEdit={handleEdit}
              trackName={trackLabel}
              actions={
                <>
                  <Button
                    size="lg"
                    onClick={handleSave}
                    disabled={!dirty || saving}
                    className="flex-1"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() =>
                      window.open(
                        getExportUrl(program.track_key),
                        "_blank",
                      )
                    }
                  >
                    View Report
                  </Button>
                </>
              }
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
