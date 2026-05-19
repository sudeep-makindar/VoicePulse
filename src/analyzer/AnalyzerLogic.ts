import { getApiKey, callNvidiaNim } from "../services/gemini";
import { getSheetsUrl, SheetRow } from "../services/sheets";

// Helper to normalize spaced/cased Google Sheets columns into proper type properties
function normalizeRow(rawRow: any): SheetRow {
  const getVal = (keys: string[]) => {
    for (const key of keys) {
      if (rawRow[key] !== undefined) return rawRow[key];
    }
    return "";
  };

  return {
    timestamp: getVal(["Timestamp", "timestamp"]),
    sessionId: getVal(["Session ID", "sessionId", "session_id"]),
    respondentName: getVal(["Respondent Name", "respondentName", "respondent_name"]),
    context: getVal(["Context", "context"]),
    q1: getVal(["Q1", "q1"]), a1: getVal(["A1", "a1"]),
    q2: getVal(["Q2", "q2"]), a2: getVal(["A2", "a2"]),
    q3: getVal(["Q3", "q3"]), a3: getVal(["A3", "a3"]),
    q4: getVal(["Q4", "q4"]), a4: getVal(["A4", "a4"]),
    q5: getVal(["Q5", "q5"]), a5: getVal(["A5", "a5"]),
    summary: getVal(["Summary", "summary"]),
    avgSentiment: Number(getVal(["Avg Sentiment", "avgSentiment", "avg_sentiment"]) || 0),
    themes: getVal(["Themes", "themes"]),
    actions: getVal(["Actions", "actions"]),
    hindsightCorrections: Number(getVal(["Hindsight Corrections", "hindsightCorrections", "hindsight_corrections"]) || 0),
  };
}

/**
 * Fetches all records from the configured Google Sheet
 */
export async function fetchSheetData(): Promise<SheetRow[]> {
  const url = getSheetsUrl();
  if (!url) return [];

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch sheet data");
    const data = await response.json();
    
    if (Array.isArray(data)) {
      return data.map(normalizeRow);
    }
    return [];
  } catch (e) {
    console.error("Error fetching sheet data:", e);
    return [];
  }
}

/**
 * Sends a batch of feedback entries to NVIDIA NIM for executive analysis
 */
export async function analyzeFeedbackBatch(entries: SheetRow[]): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey || !entries.length) return "";

  const prompt = `
    Analyze the following feedback entries collected from VoicePulse users. 
    Provide a high-level executive summary, identify top 3 recurring themes, and suggest 3 prioritized actions.
    
    Data:
    ${JSON.stringify(entries.slice(0, 20))} // Limit to 20 for context window safety
  `;

  const system = "You are a Customer Experience Strategy expert. Be concise, strategic, and data-driven.";
  
  return callNvidiaNim(apiKey, prompt, system);
}
