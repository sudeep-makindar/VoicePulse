// VoicePulse NVIDIA NIM AI Service
// Connects to minimaxai/minimax-m2.7 via integrate.api.nvidia.com OpenAI-compatible chat endpoints.

export interface DialogueTurn {
  role: "interviewer" | "respondent";
  text: string;
  timestamp: string;
}

export interface ChunkClassification {
  id: string;
  text: string;
  topic: string;
  sentiment: "positive" | "negative" | "neutral" | "ambivalent";
  intensity: "low" | "medium" | "high";
  specificity: number; // 1 to 5
}

export interface HindsightCorrection {
  chunkId: string;
  text: string;
  originalTopic: string;
  originalSentiment: string;
  correctedTopic: string;
  correctedSentiment: string;
  reasoning: string;
}

export interface SynthesisOutput {
  summary: string;
  themes: { title: string; count: number; sentiment: string; description: string }[];
  heatmap: { topic: string; score: number; count: number }[];
  highlights: { text: string; topic: string; emotionalWeight: string }[];
  actions: { task: string; priority: "high" | "medium" | "low"; category: string }[];
}

export interface PipelineResult {
  rawTranscript: string;
  cleanTranscript: DialogueTurn[];
  chunks: ChunkClassification[];
  corrections: HindsightCorrection[];
  synthesis: SynthesisOutput;
}

// Fetch helper that uses NVIDIA integrate API to call minimaxai/minimax-m2.7
export async function callNvidiaNim(apiKey: string, prompt: string, systemInstruction?: string, isJson: boolean = false): Promise<string> {
  try {
    // Always route through the relative Vite proxy to bypass browser CORS blocks in development tunnels
    const url = "/api/nvidia/v1/chat/completions";
    const messages = [];

    if (systemInstruction) {
      messages.push({ role: "system", content: systemInstruction });
    }

    messages.push({ role: "user", content: prompt });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "minimaxai/minimax-m2.7",
        messages: messages,
        temperature: 0.7,
        top_p: 0.95,
        max_tokens: 1024,
        response_format: isJson ? { type: "json_object" } : undefined
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NVIDIA API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (text) return text;
    throw new Error("Empty response from NVIDIA NIM");
  } catch (e: any) {
    console.error("NVIDIA NIM call failed:", e);
    throw e;
  }
}

// Check for API key (injected or local storage)
export function getApiKey(): string {
  const localKey = localStorage.getItem("VOICEPULSE_NVIDIA_API_KEY");
  if (localKey && localKey.trim() !== "") return localKey;

  // In Vite apps, environment variables must start with VITE_ to be exposed to client-side code
  const viteEnvKey = (import.meta as any).env?.VITE_NVIDIA_API_KEY;
  if (viteEnvKey && viteEnvKey !== "MY_NVIDIA_API_KEY" && viteEnvKey.trim() !== "") return viteEnvKey;

  const envKey = (process.env as any).NVIDIA_API_KEY || (import.meta as any).env?.VITE_NVIDIA_API_KEY;
  if (envKey && envKey !== "MY_NVIDIA_API_KEY" && envKey.trim() !== "") return envKey;

  return "";
}

export function saveApiKey(key: string) {
  if (key) {
    localStorage.setItem("VOICEPULSE_NVIDIA_API_KEY", key);
  } else {
    localStorage.removeItem("VOICEPULSE_NVIDIA_API_KEY");
  }
}

// AI Interviewer: Determines next turn
export async function getNextInterviewerTurn(history: DialogueTurn[], campaignQuestions?: string[]): Promise<string> {
  const apiKey = getApiKey();

  const activeQuestions = campaignQuestions && campaignQuestions.length > 0
    ? campaignQuestions
    : [
        "What was your overall impression of the event or product?",
        "What specifically felt like a hurdle or roadblock during onboarding?",
        "If you could change just one thing to make this experience absolutely delightful, what would that be?"
      ];

  if (!apiKey) {
    return simulateInterviewerTurn(history, activeQuestions);
  }

  // IMPROVED: Named persona, behavioral anchors, probe-vs-skip logic, voice-aware length
  const systemInstruction = `You are Pulse, VoicePulse's voice feedback agent. You conduct short, warm, conversational feedback interviews that feel human — not a survey.

Your personality: calm curiosity. You listen, acknowledge, then gently redirect.
Your constraint: every response will be spoken aloud. Keep it under 2 sentences. Never ask two things at once.

Campaign questions to work through in order:
${activeQuestions.map((q, idx) => `${idx + 1}. "${q}"`).join("\n")}

Rules:
- Never read a question verbatim. Blend it naturally into what the user just said.
- If the user gives a vague answer ("it was fine"), probe once: ask what "fine" looked like specifically.
- If they give a rich, detailed answer, skip probing and move to the next campaign question.
- If all questions are covered OR the user says they have nothing more to add, output exactly: THANK_YOU_VOICEPULSE — then a single warm closing line.`;

  const formattedHistory = history
    .map(h => `${h.role === "interviewer" ? "Pulse" : "Respondent"}: ${h.text}`)
    .join("\n");

  const prompt = `Review the dialogue history below and generate the next turn for Pulse.

${formattedHistory}

Pulse:`;

  try {
    const responseText = await callNvidiaNim(apiKey, prompt, systemInstruction);
    return responseText.trim();
  } catch (error) {
    console.error("NVIDIA NIM interviewer error, falling back to simulator:", error);
    return simulateInterviewerTurn(history, activeQuestions);
  }
}

// Heuristic Offline Campaign Questions Generator (no slicing/mock ellipsis)
function generateHeuristicQuestions(campaignPrompt: string): string[] {
  const cleanPrompt = campaignPrompt.trim();
  const lowerPrompt = cleanPrompt.toLowerCase();

  // 1. Interactive Recruitment / Interviews
  if (lowerPrompt.includes("interview") || lowerPrompt.includes("recruit") || lowerPrompt.includes("candidate")) {
    return [
      "How did you feel about the overall atmosphere and level of interaction during the interview?",
      "What specifically made the conversation feel engaging, interactive, or fun for you?",
      "What is one change that would make the interview experience more comfortable or conversational?"
    ];
  }

  // 2. Setup / Onboarding
  if (lowerPrompt.includes("onboard") || lowerPrompt.includes("setup") || lowerPrompt.includes("install") || lowerPrompt.includes("start")) {
    return [
      "What was your first impression when setting up and getting started?",
      "Where did you feel the most friction or confusion during the onboarding process?",
      "What is one key improvement that would make the setup completely seamless?"
    ];
  }

  // 3. User Interface / Design
  if (lowerPrompt.includes("design") || lowerPrompt.includes("ui") || lowerPrompt.includes("ux") || lowerPrompt.includes("visual") || lowerPrompt.includes("look")) {
    return [
      "What was your initial reaction to the overall visual design and layout?",
      "Were there any specific parts of the interface that felt confusing or cluttered?",
      "What change would make the user interface feel more modern and delightful to use?"
    ];
  }

  // 4. Performance / Speed
  if (lowerPrompt.includes("speed") || lowerPrompt.includes("performance") || lowerPrompt.includes("fast") || lowerPrompt.includes("slow") || lowerPrompt.includes("lag")) {
    return [
      "How did you feel about the overall speed and responsiveness of the system?",
      "Did you encounter any specific delays, lag, or slow load times during your session?",
      "What would make the system feel snappier or more high-performance?"
    ];
  }

  // 5. General / Catch-all subject extractor
  let subject = "the experience";
  const focusMatch = cleanPrompt.match(/(?:feedback on|regarding|about|for)\s+([^,.]+)/i);
  if (focusMatch && focusMatch[1]) {
    subject = focusMatch[1].trim();
  } else if (cleanPrompt.length < 50) {
    subject = cleanPrompt.replace(/[.?]$/, "");
  } else {
    const words = cleanPrompt.split(/\s+/).slice(0, 5).join(" ");
    subject = words.replace(/[,.?]$/, "");
  }

  return [
    `What was your overall impression of ${subject}?`,
    `What felt like the most challenging part or roadblock during ${subject}?`,
    `What is one thing that would make ${subject} absolutely delightful for you?`
  ];
}

// Helper utility to safely extract JSON arrays under strict JSON Mode constraints
function safeParseJsonArray<T>(jsonText: string): T[] {
  try {
    let cleanJson = jsonText.trim();
    
    // Find first JSON bracket or brace to slice out leading/trailing chat explanations
    const firstBracket = cleanJson.indexOf("[");
    const firstBrace = cleanJson.indexOf("{");
    
    let startIndex = -1;
    let endIndex = -1;
    
    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
      startIndex = firstBracket;
      endIndex = cleanJson.lastIndexOf("]");
    } else if (firstBrace !== -1) {
      startIndex = firstBrace;
      endIndex = cleanJson.lastIndexOf("}");
    }
    
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      cleanJson = cleanJson.substring(startIndex, endIndex + 1);
    }
    
    cleanJson = cleanJson.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    
    // 1. Raw array
    if (Array.isArray(parsed)) {
      return parsed as T[];
    }
    
    if (parsed && typeof parsed === "object") {
      // 2. Nested array property (e.g. {"questions": [...]})
      const firstArray = Object.values(parsed).find(val => Array.isArray(val));
      if (firstArray) {
        return firstArray as T[];
      }
      
      // 3. Flat string value dictionary (e.g. {"q1": "val1", "q2": "val2"})
      const values = Object.values(parsed);
      if (values.every(v => typeof v === "string")) {
        return values as unknown as T[];
      }
      
      // 4. Object dictionary (e.g. {"q1": {"question": "val1"}})
      if (values.every(v => typeof v === "object" && v !== null)) {
        const potentialStrings = values
          .map((v: any) => v.question || v.text || v.title || v.content || JSON.stringify(v))
          .filter(Boolean);
        if (potentialStrings.length > 0) {
          return potentialStrings as unknown as T[];
        }
      }
    }
    return [];
  } catch (e) {
    console.error("safeParseJsonArray failed to parse:", e);
    return [];
  }
}

// AI Campaign Generator: Defines a set of 3 target feedback questions based on operator prompt
export async function generateCampaignQuestions(campaignPrompt: string): Promise<string[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return generateHeuristicQuestions(campaignPrompt);
  }

  // IMPROVED: Voice-aware constraints, no compound questions, few-shot example anchors format
  const systemInstruction = `You are a feedback campaign architect. Given an operator's goal, generate exactly 3 conversational questions for a voice interview — questions the user will hear and answer out loud, not read.

Rules:
- Each question must be answerable in 1-3 spoken sentences
- No compound questions (no "and" joining two asks in one question)
- Prefer "what" and "how" over "did you" (open-ended over binary)
- Max 15 words per question
- Output ONLY a raw JSON array of 3 strings. No explanation. No markdown.

Example output:
["What felt most confusing during your first session?", "Where did you almost give up and why?", "What one change would make you recommend this to a friend?"]`;

  const prompt = `Goal: ${campaignPrompt}
Output:`;

  try {
    const responseText = await callNvidiaNim(apiKey, prompt, systemInstruction, true);
    const questions = safeParseJsonArray<string>(responseText);
    if (questions.length > 0) {
      return questions.slice(0, 3); // Make sure we only take exactly 3 questions
    }
    throw new Error("Invalid format returned");
  } catch (error) {
    console.error("Failed to generate campaign questions with NVIDIA NIM, falling back to heuristic generation:", error);
    return generateHeuristicQuestions(campaignPrompt);
  }
}

// CascadeFlow & Hindsight Pipeline Orchestrator
export async function runCascadeFlowPipeline(
  history: DialogueTurn[],
  onProgress?: (stage: string, progress: number, log: string) => void
): Promise<PipelineResult> {

  const rawTranscript = history.map(h => `${h.role === "interviewer" ? "AI" : "User"}: ${h.text}`).join("\n");
  const apiKey = getApiKey();

  if (!apiKey) {
    return runSimulatedPipeline(history, onProgress);
  }

  try {
    // Stage 1: Clean Transcript
    onProgress?.("clean", 10, "Initializing transcription cleanup layer...");
    await new Promise(resolve => setTimeout(resolve, 800));

    // IMPROVED: Deterministic timestamp format, no hallucinated values, role inferred from prefix
    const cleanPrompt = `Convert the raw conversation log below into a clean JSON array.

For each turn:
- Remove filler words (um, uh, like, basically, you know)
- Fix obvious transcription errors (homophones, cut-off words)
- Assign "role": "interviewer" or "respondent" based on the prefix (AI = interviewer, User = respondent)
- Set "timestamp": to the turn's index position as "turn_N" (e.g. "turn_1", "turn_2")
- Keep the meaning intact — do not paraphrase or summarize

Output ONLY the JSON array. No explanation.

Raw:
${rawTranscript}`;

    onProgress?.("clean", 25, "NVIDIA NIM formatting dialogue turns...");
    const cleanResultText = await callNvidiaNim(apiKey, cleanPrompt, "You clean raw transcript logs into JSON arrays of speech turns.", true);
    const cleanTranscript = safeParseJsonArray<DialogueTurn>(cleanResultText);
    onProgress?.("clean", 33, `Cleaned transcript created with ${cleanTranscript.length} conversation turns.`);

    // Stage 2: Chunking & Classification (respondent turns only)
    onProgress?.("extract", 35, "Segmenting transcript into atomic feedback chunks...");
    await new Promise(resolve => setTimeout(resolve, 1000));

    // IMPROVED: Filter to respondent-only turns before sending, explicit topic taxonomy,
    // one-idea-per-chunk rule, split instruction for compound sentences
    const respondentTurns = cleanTranscript
      .filter(t => t.role === "respondent")
      .map(t => t.text)
      .join("\n");

    const extractPrompt = `You are a feedback analyst. Analyze ONLY the respondent's turns below and break them into atomic units — one distinct opinion, complaint, compliment, or suggestion per chunk.

For each chunk output:
- "id": "chunk_N" (sequential)
- "text": the exact phrase from the respondent (do not paraphrase)
- "topic": one of [Onboarding, UI/UX, Features, Performance, Pricing, Support, General]
- "sentiment": "positive" | "negative" | "neutral" | "ambivalent"
- "intensity": "low" | "medium" | "high"
- "specificity": 1–5 (1 = vague opinion, 5 = specific actionable detail)

One chunk = one idea. If a sentence contains two opinions, split it into two chunks.
Output ONLY a raw JSON array.

Respondent turns:
${respondentTurns}`;

    onProgress?.("extract", 50, "Classifying chunks using real-time NVIDIA NIM heuristics...");
    const chunksText = await callNvidiaNim(apiKey, extractPrompt, "You extract feedback chunks from respondent speech and tag them with initial metadata.", true);
    const chunks = safeParseJsonArray<ChunkClassification>(chunksText);
    onProgress?.("extract", 66, `Extracted ${chunks.length} feedback chunks.`);

    // Stage 3: Hindsight Reasoning Pass
    onProgress?.("hindsight", 70, "Initiating Hindsight Retrospective Reasoning...");
    await new Promise(resolve => setTimeout(resolve, 1200));

    // IMPROVED: Explicit correction criteria, removed verifiedChunks from output ask (applied in code),
    // three concrete trigger conditions, ambivalent flag for contradictions
    const hindsightPrompt = `You are a Hindsight Reasoning Agent. You have the complete feedback conversation AND the initial classifications made in real-time.

Your task: find classification mistakes caused by incomplete early context.

A correction is warranted when:
- The user said something positive or neutral early, but later revealed it was actually negative (e.g. "it was fine" → later: "we almost quit")
- A vague topic label (e.g. "UI/UX") can be resolved to something specific based on later mentions (e.g. "the export button")
- Two contradictory statements exist about the same thing — flag the chunk as "ambivalent", not positive or negative

For each chunk that needs correction, output:
{
  "chunkId": string,
  "text": string,
  "originalTopic": string,
  "originalSentiment": string,
  "correctedTopic": string,
  "correctedSentiment": string,
  "reasoning": "one sentence explaining exactly what changed in hindsight"
}

If no chunk needs correction, output: { "corrections": [] }
Output ONLY: { "corrections": [...] }

Initial chunks:
${JSON.stringify(chunks)}

Full conversation:
${rawTranscript}`;

    onProgress?.("hindsight", 85, "Analyzing context shifts and resolving contradictions...");
    const hindsightText = await callNvidiaNim(apiKey, hindsightPrompt, "You apply retrospective context to revise early classification mistakes.", true);
    const hindsightData = JSON.parse(hindsightText);
    const corrections: HindsightCorrection[] = hindsightData.corrections || [];

    // Apply corrections to chunks in code rather than asking model to re-emit the full list
    const verifiedChunks: ChunkClassification[] = chunks.map(chunk => {
      const fix = corrections.find(c => c.chunkId === chunk.id);
      if (fix) {
        return {
          ...chunk,
          topic: fix.correctedTopic,
          sentiment: fix.correctedSentiment as ChunkClassification["sentiment"],
        };
      }
      return chunk;
    });

    onProgress?.("hindsight", 100, `Hindsight completed. Corrected ${corrections.length} misclassifications.`);

    // Stage 4: Synthesis & Output Generation
    onProgress?.("synthesis", 10, "Aggregating data into final structured executive report...");
    await new Promise(resolve => setTimeout(resolve, 1000));

    // IMPROVED: Field-level structure + length constraints, summary formula defined,
    // ordering rules, no vague quality signals like "compelling"
    const synthesisPrompt = `You are a product analytics engine. Generate an operator dashboard report from the verified feedback chunks below.

Output a single JSON object with exactly these keys:

"summary": 3 sentences. Sentence 1: overall verdict. Sentence 2: top friction point. Sentence 3: top positive signal or one concrete recommendation.

"themes": array of up to 4 objects — { "title": string, "count": number, "sentiment": string, "description": string (max 12 words) }. Order by count descending.

"heatmap": one object per unique topic — { "topic": string, "score": number (0–100 where 0 = purely frustrated, 100 = purely delighted), "count": number }.

"highlights": 2–3 verbatim quotes from the respondent with highest emotional weight — { "text": string (include surrounding quotation marks), "topic": string, "emotionalWeight": "high" | "medium" | "low" }.

"actions": exactly 3 action items for the product team — { "task": string (specific, under 12 words), "priority": "high" | "medium" | "low", "category": string }. Order by priority descending.

Output ONLY the JSON object. No explanation.

Verified chunks:
${JSON.stringify(verifiedChunks)}`;

    onProgress?.("synthesis", 50, "Synthesizing sentiment heatmap and extracting highlight reel...");
    const synthesisText = await callNvidiaNim(apiKey, synthesisPrompt, "You generate structured, actionable operator dashboard reports in JSON.", true);
    const synthesis: SynthesisOutput = JSON.parse(synthesisText);
    onProgress?.("synthesis", 100, "CascadeFlow successfully finished! Surfacing insights to Operator Dashboard.");

    return {
      rawTranscript,
      cleanTranscript,
      chunks: verifiedChunks,
      corrections,
      synthesis
    };

  } catch (error) {
    console.error("CascadeFlow pipeline failed on NVIDIA NIM API, falling back to simulator:", error);
    onProgress?.("synthesis", 100, "API pipeline encountered an error. Engaging Simulated Intelligence Engine...");
    return runSimulatedPipeline(history, onProgress);
  }
}

// ==========================================
// SIMULATION ENGINE (Fallback and Demo Mode)
// ==========================================

function simulateInterviewerTurn(history: DialogueTurn[], campaignQuestions: string[]): string {
  const userTurns = history.filter(h => h.role === "respondent");
  const nextQuestionIdx = userTurns.length;

  if (nextQuestionIdx < campaignQuestions.length) {
    const rawQuestion = campaignQuestions[nextQuestionIdx];

    if (nextQuestionIdx === 0) {
      return rawQuestion;
    }

    const lastUserTurn = userTurns[userTurns.length - 1];
    const lastText = lastUserTurn ? lastUserTurn.text.toLowerCase() : "";

    let transitionPrefix = "";
    if (lastText.includes("good") || lastText.includes("great") || lastText.includes("awesome") || lastText.includes("love") || lastText.includes("easy") || lastText.includes("fine")) {
      const positiveTransitions = [
        "That's wonderful to hear! Building on that positive experience, ",
        "I'm glad to hear that. Expanding on that, ",
        "Awesome! Moving forward, ",
        "That makes total sense and sounds like a win. Let's look closer: "
      ];
      transitionPrefix = positiveTransitions[nextQuestionIdx % positiveTransitions.length];
    } else if (lastText.includes("hard") || lastText.includes("error") || lastText.includes("stuck") || lastText.includes("crash") || lastText.includes("difficult") || lastText.includes("annoy") || lastText.includes("quit") || lastText.includes("frustrat")) {
      const frictionTransitions = [
        "I completely understand how frustrating that hurdle is. Looking further into it, ",
        "Ouch, that sounds like a tough roadblock. Acknowledging that, ",
        "Thanks for highlighting that friction point. To help clarify, ",
        "That makes sense, and I understand the frustration. On a similar note, "
      ];
      transitionPrefix = frictionTransitions[nextQuestionIdx % frictionTransitions.length];
    } else if (lastText.length > 0) {
      const neutralTransitions = [
        "Got it, thank you for sharing that. Next, ",
        "Makes complete sense. Moving right along, ",
        "Ah, I see. Acknowledging that, let's explore: ",
        "That's really valuable context. To expand on that, "
      ];
      transitionPrefix = neutralTransitions[nextQuestionIdx % neutralTransitions.length];
    } else {
      transitionPrefix = "";
    }

    const adjustedQuestion = rawQuestion.charAt(0).toLowerCase() + rawQuestion.slice(1);
    return `${transitionPrefix}${adjustedQuestion}`;
  }

  return "THANK_YOU_VOICEPULSE";
}

async function runSimulatedPipeline(
  history: DialogueTurn[],
  onProgress?: (stage: string, progress: number, log: string) => void
): Promise<PipelineResult> {
  const rawTranscript = history.map(h => `${h.role === "interviewer" ? "AI" : "User"}: ${h.text}`).join("\n");

  // Step 1: Clean
  onProgress?.("clean", 10, "Initializing transcription cleanup layer...");
  await new Promise(resolve => setTimeout(resolve, 800));
  onProgress?.("clean", 60, "Normalizing audio stream, resolving filler words...");
  await new Promise(resolve => setTimeout(resolve, 400));

  const cleanTranscript = history.map((h, idx) => ({
    ...h,
    timestamp: `turn_${idx + 1}`,
    text: h.text.replace(/\b(um|uh|like|so|basically)\b/gi, "").replace(/\s+/g, " ").trim()
  }));

  onProgress?.("clean", 100, `Cleaned transcript created with ${cleanTranscript.length} conversation turns.`);

  // Step 2: Chunking & Classification
  onProgress?.("extract", 20, "Segmenting transcript into atomic feedback chunks...");
  await new Promise(resolve => setTimeout(resolve, 600));
  onProgress?.("extract", 70, "Applying real-time topic modeling & sentiment weights...");
  await new Promise(resolve => setTimeout(resolve, 600));

  const userSpeech = history.filter(h => h.role === "respondent").map(h => h.text).join(" ");
  const userSpeechLower = userSpeech.toLowerCase();

  const chunks: ChunkClassification[] = [];

  let chunkCount = 1;
  const addChunk = (text: string, topic: string, sentiment: "positive" | "negative" | "neutral" | "ambivalent", intensity: "low" | "medium" | "high", specificity: number) => {
    chunks.push({ id: `chunk_${chunkCount++}`, text, topic, sentiment, intensity, specificity });
  };

  const sentences = userSpeech.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 5);

  if (sentences.length === 0) {
    addChunk("The experience was quite interesting and helpful.", "General", "positive", "medium", 2);
  } else {
    sentences.forEach((sentence) => {
      const lower = sentence.toLowerCase();
      let topic = "General";
      let sentiment: "positive" | "negative" | "neutral" | "ambivalent" = "neutral";
      let intensity: "low" | "medium" | "high" = "medium";
      let specificity = 2;

      if (lower.includes("setup") || lower.includes("install") || lower.includes("onboard") || lower.includes("start")) {
        topic = "Onboarding"; specificity = 3;
      } else if (lower.includes("ui") || lower.includes("ux") || lower.includes("dashboard") || lower.includes("look") || lower.includes("screen") || lower.includes("visual")) {
        topic = "UI/UX"; specificity = 3;
      } else if (lower.includes("feature") || lower.includes("api") || lower.includes("tool") || lower.includes("widget")) {
        topic = "Features"; specificity = 4;
      } else if (lower.includes("price") || lower.includes("cost") || lower.includes("free")) {
        topic = "Pricing"; specificity = 4;
      }

      if (lower.includes("great") || lower.includes("awesome") || lower.includes("delightful") || lower.includes("love") || lower.includes("easy") || lower.includes("good")) {
        sentiment = "positive";
        if (lower.includes("love") || lower.includes("awesome")) intensity = "high";
      } else if (lower.includes("error") || lower.includes("crash") || lower.includes("hard") || lower.includes("difficult") || lower.includes("annoying") || lower.includes("bad") || lower.includes("quit") || lower.includes("frustrated")) {
        sentiment = "negative"; intensity = "high"; specificity += 1;
      }

      addChunk(sentence, topic, sentiment, intensity, specificity);
    });
  }

  onProgress?.("extract", 100, `Extracted ${chunks.length} feedback chunks.`);

  // Step 3: Hindsight Corrections
  onProgress?.("hindsight", 20, "Initiating Hindsight Retrospective Reasoning...");
  await new Promise(resolve => setTimeout(resolve, 800));
  onProgress?.("hindsight", 60, "Scanning for context shifts, early contradictions & semantic updates...");
  await new Promise(resolve => setTimeout(resolve, 800));

  const corrections: HindsightCorrection[] = [];

  chunks.forEach(chunk => {
    const textLower = chunk.text.toLowerCase();

    if (chunk.topic === "Onboarding" && chunk.sentiment === "positive" && (userSpeechLower.includes("crash") || userSpeechLower.includes("stuck") || userSpeechLower.includes("error"))) {
      corrections.push({
        chunkId: chunk.id,
        text: chunk.text,
        originalTopic: chunk.topic,
        originalSentiment: "positive",
        correctedTopic: "Onboarding",
        correctedSentiment: "ambivalent",
        reasoning: "Respondent initially stated onboarding was 'fine', but later detailed significant setup issues and errors. Hindsight reveals early sentiment was polite compliance, overall experience was highly ambivalent."
      });
      chunk.sentiment = "ambivalent";
    }

    if (chunk.topic === "UI/UX" && textLower.includes("dashboard") && (userSpeechLower.includes("analytics") || userSpeechLower.includes("chart"))) {
      corrections.push({
        chunkId: chunk.id,
        text: chunk.text,
        originalTopic: "UI/UX",
        originalSentiment: chunk.sentiment,
        correctedTopic: "Analytics Panel",
        correctedSentiment: chunk.sentiment,
        reasoning: "General complaint about 'the dashboard' is resolved in hindsight to the Analytics Panel, following later mentions of charts."
      });
      chunk.topic = "Analytics Panel";
    }
  });

  onProgress?.("hindsight", 100, `Hindsight completed. Resolved and corrected ${corrections.length} context shifts.`);

  // Step 4: Synthesis
  onProgress?.("synthesis", 20, "Aggregating corrected units into dashboard KPIs...");
  await new Promise(resolve => setTimeout(resolve, 800));
  onProgress?.("synthesis", 70, "Formulating executive summary and compiling priority action list...");
  await new Promise(resolve => setTimeout(resolve, 600));

  const positiveCount = chunks.filter(c => c.sentiment === "positive").length;
  const negativeCount = chunks.filter(c => c.sentiment === "negative").length;

  let overallSummary = "The user generally had a positive interaction with the platform, praising its rapid responsiveness. However, setup friction and confusion surrounding deep features emerged as notable barriers. Corrective UI changes are recommended.";
  if (negativeCount > positiveCount) {
    overallSummary = "The feedback session reveals severe onboarding barriers and functional errors. While the user appreciates the visual design, they were unable to successfully complete their primary goals due to setup complications. Prioritize deployment and error logging fixes.";
  } else if (positiveCount > 3) {
    overallSummary = "An exceptionally positive session — the user found onboarding seamless and the conversational interface intuitive. Only minor improvements to export filters were flagged. Ship and move to the next persona.";
  }

  const synthesis: SynthesisOutput = {
    summary: overallSummary,
    themes: [
      {
        title: "Setup Friction",
        count: userSpeechLower.includes("setup") || userSpeechLower.includes("install") ? 2 : 1,
        sentiment: userSpeechLower.includes("error") ? "negative" : "mixed",
        description: "Initial environment scripts failed or felt overly complex."
      },
      {
        title: "Conversational Widget UX",
        count: 2,
        sentiment: "positive",
        description: "Microphone-driven interface is intuitive and faster than typing."
      },
      {
        title: "Analytics Depth",
        count: userSpeechLower.includes("analytics") || userSpeechLower.includes("chart") ? 1 : 0,
        sentiment: "neutral",
        description: "Operator requires clearer data breakdowns and export options."
      }
    ].filter(t => t.count > 0),
    heatmap: [
      { topic: "Onboarding", score: userSpeechLower.includes("error") ? 35 : 75, count: chunks.filter(c => c.topic === "Onboarding").length || 1 },
      { topic: "UI/UX", score: 85, count: chunks.filter(c => c.topic === "UI/UX" || c.topic === "Analytics Panel").length || 1 },
      { topic: "Features", score: 60, count: chunks.filter(c => c.topic === "Features").length || 1 },
      { topic: "General", score: 70, count: chunks.filter(c => c.topic === "General").length || 1 }
    ],
    highlights: chunks.filter(c => c.intensity === "high").slice(0, 3).map(c => ({
      text: `"${c.text}"`,
      topic: c.topic,
      emotionalWeight: c.intensity
    })),
    actions: [
      {
        task: "Simplify onboarding scripts and supply Docker stubs",
        priority: userSpeechLower.includes("error") ? "high" : "medium",
        category: "Onboarding"
      },
      {
        task: "Increase touch targets on microphone button",
        priority: "medium",
        category: "UI/UX"
      },
      {
        task: "Add PDF and CSV download options to dashboard",
        priority: "low",
        category: "Feature Request"
      }
    ]
  };

  onProgress?.("synthesis", 100, "CascadeFlow successfully finished! Surfacing insights to Operator Dashboard.");

  return {
    rawTranscript,
    cleanTranscript,
    chunks,
    corrections,
    synthesis
  };
}

// Seed data
export function getSeedSessions(): { id: string; name: string; context: string; timestamp: string; result: PipelineResult }[] {
  return [
    {
      id: "session_hackathon_1",
      name: "Alex Rivera (Hackathon Attendee)",
      context: "Feedback regarding the AI Web Studio Platform",
      timestamp: "10 mins ago",
      result: {
        rawTranscript: "AI: How was your overall experience?\nUser: The setup was fine, really quick to get going.\nAI: Great. Did you hit any hurdles during development?\nUser: Actually, later when we tried to deploy, the build crashed. The console gave a cryptic error, and we wasted like two hours debugging it. We almost quit the hackathon. It would have been good to have clear troubleshooting stubs.\nAI: Oh, sorry to hear that. Any final thoughts on UI?\nUser: The dashboard UI is nice, especially the real-time analytics graphs.",
        cleanTranscript: [
          { role: "interviewer", text: "How was your overall experience?", timestamp: "turn_1" },
          { role: "respondent", text: "The setup was fine, really quick to get going.", timestamp: "turn_2" },
          { role: "interviewer", text: "Great. Did you hit any hurdles during development?", timestamp: "turn_3" },
          { role: "respondent", text: "Actually, later when we tried to deploy, the build crashed. The console gave a cryptic error, and we wasted like two hours debugging it. We almost quit the hackathon. It would have been good to have clear troubleshooting stubs.", timestamp: "turn_4" },
          { role: "interviewer", text: "Oh, sorry to hear that. Any final thoughts on UI?", timestamp: "turn_5" },
          { role: "respondent", text: "The dashboard UI is nice, especially the real-time analytics graphs.", timestamp: "turn_6" }
        ],
        chunks: [
          { id: "c1", text: "The setup was fine, really quick to get going.", topic: "Onboarding", sentiment: "ambivalent", intensity: "low", specificity: 2 },
          { id: "c2", text: "Actually, later when we tried to deploy, the build crashed.", topic: "Deployments", sentiment: "negative", intensity: "high", specificity: 4 },
          { id: "c3", text: "The console gave a cryptic error, and we wasted like two hours debugging it.", topic: "Deployments", sentiment: "negative", intensity: "high", specificity: 5 },
          { id: "c4", text: "We almost quit the hackathon.", topic: "General", sentiment: "negative", intensity: "high", specificity: 3 },
          { id: "c5", text: "The dashboard UI is nice, especially the real-time analytics graphs.", topic: "Analytics Panel", sentiment: "positive", intensity: "medium", specificity: 4 }
        ],
        corrections: [
          {
            chunkId: "c1",
            text: "The setup was fine, really quick to get going.",
            originalTopic: "Onboarding",
            originalSentiment: "positive",
            correctedTopic: "Onboarding",
            correctedSentiment: "ambivalent",
            reasoning: "Respondent praised setup as 'fine' but later revealed a build crash cost two hours — early sentiment was polite compliance, not genuine satisfaction."
          },
          {
            chunkId: "c5",
            text: "The dashboard UI is nice, especially the real-time analytics graphs.",
            originalTopic: "UI/UX",
            originalSentiment: "positive",
            correctedTopic: "Analytics Panel",
            correctedSentiment: "positive",
            reasoning: "General 'dashboard UI' resolved to 'Analytics Panel' due to specific praise for real-time analytics graphs mentioned later."
          }
        ],
        synthesis: {
          summary: "Alex's session started positively but was derailed by a critical build crash during deployment, costing two hours of hackathon time. The real-time analytics UI was a genuine highlight once the team recovered. Fix deployment error logging before the next event.",
          themes: [
            { title: "Critical Build Failures", count: 2, sentiment: "negative", description: "Deployments crashed with obscure console errors." },
            { title: "Beautiful Visual Charts", count: 1, sentiment: "positive", description: "Real-time graphing UI delighted the respondent." }
          ],
          heatmap: [
            { topic: "Onboarding", score: 40, count: 1 },
            { topic: "Deployments", score: 10, count: 2 },
            { topic: "Analytics Panel", score: 95, count: 1 },
            { topic: "General", score: 30, count: 1 }
          ],
          highlights: [
            { text: "\"We wasted like two hours debugging it. We almost quit the hackathon.\"", topic: "Deployments", emotionalWeight: "high" },
            { text: "\"The setup was fine, really quick to get going.\"", topic: "Onboarding", emotionalWeight: "low" }
          ],
          actions: [
            { task: "Surface clean error logs in deployment console stdout", priority: "high", category: "Deployments" },
            { task: "Add pre-deployment checklist widget to dashboard", priority: "medium", category: "UI/UX" },
            { task: "Provide one-click Docker stub for local environment setup", priority: "low", category: "Onboarding" }
          ]
        }
      }
    },
    {
      id: "session_saas_2",
      name: "Marcus Vance (SaaS Trial User)",
      context: "Pulse feedback on CRM feature set",
      timestamp: "1 hour ago",
      result: {
        rawTranscript: "AI: What did you think of the new CRM layout?\nUser: It looked okay on the screen.\nAI: Okay, what stood out specifically?\nUser: The visual charts on the main page were a bit confusing actually. I couldn't find the email integration button at first until I read the docs. But once I got the email connected, the automated syncing was absolutely magical. It saved me a ton of time already.\nAI: Glad the sync worked out. Any layout complaints?\nUser: Just make the main screen buttons larger.",
        cleanTranscript: [
          { role: "interviewer", text: "What did you think of the new CRM layout?", timestamp: "turn_1" },
          { role: "respondent", text: "It looked okay on the screen.", timestamp: "turn_2" },
          { role: "interviewer", text: "Okay, what stood out specifically?", timestamp: "turn_3" },
          { role: "respondent", text: "The visual charts on the main page were a bit confusing actually. I couldn't find the email integration button at first until I read the docs. But once I got the email connected, the automated syncing was absolutely magical. It saved me a ton of time already.", timestamp: "turn_4" },
          { role: "interviewer", text: "Glad the sync worked out. Any layout complaints?", timestamp: "turn_5" },
          { role: "respondent", text: "Just make the main screen buttons larger.", timestamp: "turn_6" }
        ],
        chunks: [
          { id: "s1", text: "It looked okay on the screen.", topic: "UI/UX", sentiment: "ambivalent", intensity: "low", specificity: 1 },
          { id: "s2", text: "The visual charts on the main page were a bit confusing actually.", topic: "UI/UX", sentiment: "negative", intensity: "medium", specificity: 3 },
          { id: "s3", text: "I couldn't find the email integration button at first until I read the docs.", topic: "Features", sentiment: "negative", intensity: "medium", specificity: 4 },
          { id: "s4", text: "But once I got the email connected, the automated syncing was absolutely magical.", topic: "Features", sentiment: "positive", intensity: "high", specificity: 4 },
          { id: "s5", text: "Just make the main screen buttons larger.", topic: "UI/UX", sentiment: "neutral", intensity: "low", specificity: 2 }
        ],
        corrections: [
          {
            chunkId: "s1",
            text: "It looked okay on the screen.",
            originalTopic: "UI/UX",
            originalSentiment: "neutral",
            correctedTopic: "UI/UX",
            correctedSentiment: "ambivalent",
            reasoning: "Safe 'okay' opener is reweighted as ambivalent — subsequent turns revealed chart confusion and small button complaints."
          }
        ],
        synthesis: {
          summary: "Marcus found the layout acceptable at first glance but uncovered real friction with confusing charts and a hidden email integration button. Once connected, the automated sync was a standout delight. Prioritize discoverability of key action buttons.",
          themes: [
            { title: "Email Sync Delight", count: 2, sentiment: "positive", description: "Automated sync delivers outstanding time savings." },
            { title: "Confusing Visual Charts", count: 1, sentiment: "negative", description: "Dashboard layout displays high visual complexity." }
          ],
          heatmap: [
            { topic: "UI/UX", score: 55, count: 3 },
            { topic: "Features", score: 70, count: 2 }
          ],
          highlights: [
            { text: "\"The automated syncing was absolutely magical. It saved me a ton of time.\"", topic: "Features", emotionalWeight: "high" },
            { text: "\"The visual charts on the main page were a bit confusing actually.\"", topic: "UI/UX", emotionalWeight: "medium" }
          ],
          actions: [
            { task: "Add tooltip to email integration button for discoverability", priority: "high", category: "Features" },
            { task: "Restyle dashboard graphs with reduced visual density", priority: "medium", category: "UI/UX" },
            { task: "Increase tap target size on all primary action buttons", priority: "low", category: "UI/UX" }
          ]
        }
      }
    }
  ];
}
