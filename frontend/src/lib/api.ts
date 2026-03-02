import type { CertOpsOutput } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export async function fetchCached(trackKey: string): Promise<CertOpsOutput> {
  if (API_URL) {
    try {
      const res = await fetch(`${API_URL}/cached/${trackKey}`);
      if (res.ok) return res.json();
    } catch {
      // backend unreachable — fall through to static data
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

export function getExportUrl(trackKey: string): string {
  if (API_URL) return `${API_URL}/export/${trackKey}/html`;
  return `/data/certops_${trackKey}_report.html`;
}
