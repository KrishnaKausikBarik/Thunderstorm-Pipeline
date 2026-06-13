import type { DimFinalizeResponse } from '../types';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const configuredApiUrl = import.meta.env.VITE_API_URL as string | undefined;
const backendBase = trimTrailingSlash(
  import.meta.env.DEV ? configuredApiUrl || "http://localhost:8000" : "/_/backend"
);

export const API_BASE = backendBase.endsWith("/api") ? backendBase : `${backendBase}/api`;

export interface ClaudeConfigStatus {
  configured: boolean;
  model: string;
}

export async function fetchClaudeConfig(): Promise<ClaudeConfigStatus> {
  const response = await fetch(`${API_BASE}/settings/claude`);
  if (!response.ok) {
    throw new Error("Failed to load Claude API configuration");
  }
  return response.json();
}

export async function updateClaudeConfig(payload: {
  api_key: string;
  model: string;
}): Promise<ClaudeConfigStatus> {
  const response = await fetch(`${API_BASE}/settings/claude`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || "Failed to configure Claude API");
  }
  return response.json();
}

export const getDownloadUrl = (filename: string, sessionId: string) => {
  return `${API_BASE}/download/${filename}?session_id=${sessionId}`;
};

export const getPreviewUrl = (filename: string, sessionId: string) => {
  return `${API_BASE}/preview/${filename}?session_id=${sessionId}`;
};

export async function fetchPreview(filename: string, sessionId: string) {
  const response = await fetch(getPreviewUrl(filename, sessionId));
  if (!response.ok) {
    throw new Error("Failed to load preview");
  }
  return response.json();
}

export async function applyEdaPreprocessing(payload: {
  file_path: string;
  session_id: string;
  imputations: Record<string, string>;
  outliers: Record<string, string>;
  remove_duplicates: boolean;
  drop_near_constant: boolean;
}) {
  const response = await fetch(`${API_BASE}/eda/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || "Failed to apply preprocessing");
  }
  return response.json();
}

export async function fetchDerivedCatalog(payload: {
  file_path: string;
  session_id: string;
  selected_params: string[];
}) {
  const response = await fetch(`${API_BASE}/derived`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Failed to fetch derived parameters catalog");
  }
  return response.json();
}

export async function analyzeDimensionality(payload: {
  file_path: string;
  session_id: string;
  active_columns: string[];
}) {
  const response = await fetch(`${API_BASE}/dimensionality/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Failed to analyze dimensionality");
  }
  return response.json();
}

export async function finalizeDimensionality(payload: {
  file_path: string;
  session_id: string;
  retained_features: string[];
  dropped_features: string[];
}): Promise<DimFinalizeResponse> {
  const response = await fetch(`${API_BASE}/dimensionality/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || "Failed to finalize dataset");
  }
  return response.json();
}
