import { getApiKey, callNvidiaNim } from "../services/gemini";
import { getSheetsUrl, SheetRow } from "../services/sheets";

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
    return data as SheetRow[];
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
