/**
 * VoicePulse — Google Sheets Recording Service
 *
 * Architecture:
 *   CascadeFlow result → POST → Google Apps Script Web App → Google Sheet row appended
 *
 * Setup instructions:
 *   1. Open https://script.google.com and create a new project
 *   2. Paste the Apps Script code from README into Code.gs
 *   3. Deploy as "Web App" (Execute as: Me, Who has access: Anyone)
 *   4. Copy the deployed URL and paste it into VoicePulse Operator Console → API Keys → Sheet URL
 */

import { PipelineResult, DialogueTurn } from "./gemini";

export interface SheetRow {
  timestamp: string;
  sessionId: string;
  respondentName: string;
  context: string;
  // Q&A pairs — up to 5 turns, flattened columns
  q1: string; a1: string;
  q2: string; a2: string;
  q3: string; a3: string;
  q4: string; a4: string;
  q5: string; a5: string;
  // Pipeline synthesis
  summary: string;
  avgSentiment: number;
  themes: string;
  actions: string;
  hindsightCorrections: number;
}

export function getSheetsUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_GOOGLE_SHEETS_URL;
  if (envUrl && envUrl.trim() !== "") return envUrl;

  // Fallback default Apps Script URL
  return "https://script.google.com/macros/s/AKfycbxML-Ay3CuCNN_Iz3RDP2nUlEoWA8ctS_XCS_QlQeMe7ZgWs4a-xzJ4YWEJsQzxfYysuQ/exec";
}

export function saveSheetsUrl(url: string) {
  // No-op, managed by environment variables
}

function buildRow(
  sessionId: string,
  respondentName: string,
  context: string,
  history: DialogueTurn[],
  result: PipelineResult
): SheetRow {
  // Extract up to 5 interviewer→respondent pairs from history
  const pairs: { q: string; a: string }[] = [];
  for (let i = 0; i < history.length - 1; i++) {
    if (history[i].role === "interviewer" && history[i + 1].role === "respondent") {
      pairs.push({ q: history[i].text, a: history[i + 1].text });
    }
  }

  const get = (idx: number, field: "q" | "a") => pairs[idx]?.[field] ?? "";

  const avgSentiment = result.synthesis.heatmap.length
    ? Math.round(
        result.synthesis.heatmap.reduce((sum, h) => sum + h.score, 0) /
          result.synthesis.heatmap.length
      )
    : 0;

  return {
    timestamp: new Date().toISOString(),
    sessionId,
    respondentName,
    context,
    q1: get(0, "q"), a1: get(0, "a"),
    q2: get(1, "q"), a2: get(1, "a"),
    q3: get(2, "q"), a3: get(2, "a"),
    q4: get(3, "q"), a4: get(3, "a"),
    q5: get(4, "q"), a5: get(4, "a"),
    summary: result.synthesis.summary,
    avgSentiment,
    themes: result.synthesis.themes.map(t => `${t.title} (${t.sentiment})`).join("; "),
    actions: result.synthesis.actions.map(a => `[${a.priority.toUpperCase()}] ${a.task}`).join("; "),
    hindsightCorrections: result.corrections.length,
  };
}

export async function recordSessionToSheet(
  sessionId: string,
  respondentName: string,
  context: string,
  history: DialogueTurn[],
  result: PipelineResult
): Promise<{ success: boolean; error?: string }> {
  const url = getSheetsUrl();

  if (!url) {
    return { success: false, error: "No Google Sheets URL configured." };
  }

  const row = buildRow(sessionId, respondentName, context, history, result);

  try {
    // Google Apps Script Web Apps require no-cors or a CORS-enabled deployment.
    // We send as text/plain with JSON body — the Apps Script reads it via e.postData.contents
    const response = await fetch(url, {
      method: "POST",
      mode: "no-cors", // Apps Script doesn't return CORS headers by default
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(row),
    });

    // no-cors responses are opaque — we can't read status.
    // Treat successful network call as success.
    return { success: true };
  } catch (e: any) {
    console.error("Google Sheets recording failed:", e);
    return { success: false, error: e?.message || "Network error posting to Sheets." };
  }
}
