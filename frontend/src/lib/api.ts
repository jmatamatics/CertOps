import type {
  CertOpsOutput,
  ArtifactKey,
  SavedProgram,
  SavedProgramSummary,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export async function fetchCached(trackKey: string): Promise<CertOpsOutput> {
  if (API_URL) {
    try {
      const res = await fetch(`${API_URL}/cached/${trackKey}`);
      if (res.ok) return res.json();
    } catch {
      // backend unreachable - fall through to static data
    }
  }

  const res = await fetch(`/data/certops_${trackKey}_output.json`);
  if (!res.ok) throw new Error(`No cached data for ${trackKey}`);
  return res.json();
}

export async function generateLive(
  track: string
): Promise<CertOpsOutput> {
  if (!API_URL) throw new Error("Backend not configured. Set NEXT_PUBLIC_API_URL.");

  const res = await fetch(`${API_URL}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ track }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail);
  }
  return res.json();
}

export async function editArtifact(
  threadId: string,
  artifactKey: ArtifactKey,
  updatedData: unknown,
): Promise<CertOpsOutput> {
  if (!API_URL) throw new Error("Backend not configured. Set NEXT_PUBLIC_API_URL.");

  const res = await fetch(`${API_URL}/edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      thread_id: threadId,
      artifact_key: artifactKey,
      updated_data: updatedData,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail);
  }
  return res.json();
}

export async function generateCustom(
  name: string,
  description: string,
  urls: string[],
  files: File[],
): Promise<CertOpsOutput> {
  if (!API_URL) throw new Error("Backend not configured. Set NEXT_PUBLIC_API_URL.");

  const form = new FormData();
  form.append("name", name);
  form.append("description", description);
  form.append("urls", JSON.stringify(urls));
  for (const file of files) {
    form.append("files", file);
  }

  const res = await fetch(`${API_URL}/generate-custom`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail);
  }
  return res.json();
}

export function getExportUrl(trackKey: string): string {
  if (API_URL) return `${API_URL}/export/${trackKey}/html`;
  return `/data/certops_${trackKey}_report.html`;
}

// ── Programs CRUD ──

export async function listPrograms(): Promise<SavedProgramSummary[]> {
  if (!API_URL) return [];

  const res = await fetch(`${API_URL}/programs`);
  if (!res.ok) throw new Error("Failed to load saved programs");
  return res.json();
}

export async function getProgram(id: string): Promise<SavedProgram> {
  if (!API_URL) throw new Error("Backend not configured.");

  const res = await fetch(`${API_URL}/programs/${id}`);
  if (!res.ok) throw new Error("Program not found");
  return res.json();
}

export async function saveProgram(
  name: string,
  trackKey: string,
  artifacts: CertOpsOutput,
): Promise<SavedProgram> {
  if (!API_URL) throw new Error("Backend not configured.");

  const res = await fetch(`${API_URL}/programs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, track_key: trackKey, artifacts }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail);
  }
  return res.json();
}

export async function updateProgram(
  id: string,
  artifacts: CertOpsOutput,
): Promise<SavedProgram> {
  if (!API_URL) throw new Error("Backend not configured.");

  const res = await fetch(`${API_URL}/programs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ artifacts }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail);
  }
  return res.json();
}

export async function deleteProgram(id: string): Promise<void> {
  if (!API_URL) throw new Error("Backend not configured.");

  const res = await fetch(`${API_URL}/programs/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete program");
}
