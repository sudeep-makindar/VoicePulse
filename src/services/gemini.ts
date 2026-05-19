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
async function callNvidiaNim(apiKey: string, prompt: string, systemInstruction?: string, isJson: boolean = false): Promise<string> {
  try {
    const url = "https://integrate.api.nvidia.com/v1/chat/completions";
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
  
  const envKey = (process.env as any).NVIDIA_API_KEY;
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
export async function getNextInterviewerTurn(history: DialogueTurn[]): Promise<string> {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    return simulateInterviewerTurn(history);
  }

  const systemInstruction = `You are VoicePulse AI, an empathetic, premium, conversational feedback agent. 
Your goal is to conduct a fast, voice-first feedback interview (max 3-4 questions total).
The user is speaking to you. You must:
1. Listen closely to what they say.
2. Respond conversationally, keeping questions concise (under 20 words) since they are read out loud.
3. If their statement was brief or vague (e.g., "it was good" or "the setup was tough"), probe gently for details (e.g., "What specifically was difficult about the setup?").
4. Never ask double-barreled or complex multi-part questions. One question at a time.
5. If the conversation has covered their main thoughts (about 2-3 user turns), or if they express they have nothing more to add, conclude by outputting EXACTLY "THANK_YOU_VOICEPULSE" and a short wrap-up message.

Current history of conversation is provided below.`;

  const formattedHistory = history
    .map(h => `${h.role === "interviewer" ? "AI Interviewer" : "Respondent"}: ${h.text}`)
    .join("\n");

  const prompt = `Review the dialog history below and generate the next turn.

${formattedHistory}

AI Interviewer:`;

  try {
    const responseText = await callNvidiaNim(apiKey, prompt, systemInstruction);
    return responseText.trim();
  } catch (error) {
    console.error("NVIDIA NIM interviewer error, falling back to simulator:", error);
    return simulateInterviewerTurn(history);
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
    // Stage 1: Clean Transcript & Schema Check
    onProgress?.("clean", 10, "Initializing transcription cleanup layer...");
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const cleanPrompt = `Convert the following raw audio transcription history into a structured clean JSON array.
Fix stuttering, remove filler words (um, uh, like), and output a valid JSON array of objects with fields "role" ("interviewer" or "respondent"), "text" (string), and "timestamp" (string).

Raw:
${rawTranscript}`;
    
    onProgress?.("clean", 25, "NVIDIA NIM formatting dialogue turns...");
    const cleanResultText = await callNvidiaNim(apiKey, cleanPrompt, "You clean raw transcript logs into JSON arrays of speech turns.", true);
    const cleanTranscript: DialogueTurn[] = JSON.parse(cleanResultText);
    onProgress?.("clean", 33, `Cleaned transcript created with ${cleanTranscript.length} conversation turns.`);

    // Stage 2: Chunking & Classification
    onProgress?.("extract", 35, "Segmenting transcript into atomic feedback chunks...");
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const extractPrompt = `Break this cleaned conversation history into distinct, atomic feedback chunks (where the respondent is expressing an opinion, complaint, suggestion, or positive comment).
For each chunk, assign the following INITIAL classifications in JSON format:
- "id": a unique string (e.g. "chunk_1")
- "text": the precise sentence/phrase
- "topic": a high-level label (e.g. "Onboarding", "UI/UX", "Pricing", "Features", "General")
- "sentiment": "positive", "negative", or "neutral"
- "intensity": "low", "medium", or "high"
- "specificity": an integer from 1 to 5 (1 = highly vague, 5 = extremely detailed)

Transcript:
${JSON.stringify(cleanTranscript)}`;

    onProgress?.("extract", 50, "Classifying chunks using real-time NVIDIA NIM heuristics...");
    const chunksText = await callNvidiaNim(apiKey, extractPrompt, "You extract feedback chunks and tag them with initial metadata.", true);
    const chunks: ChunkClassification[] = JSON.parse(chunksText);
    onProgress?.("extract", 66, `Extracted ${chunks.length} feedback chunks.`);

    // Stage 3: Hindsight Reasoning Pass
    onProgress?.("hindsight", 70, "Initiating Hindsight Retrospective Reasoning...");
    await new Promise(resolve => setTimeout(resolve, 1200));

    const hindsightPrompt = `You are a Hindsight Reasoning Agent. You have the complete transcript of the feedback conversation.
Your job is to review every initial classification tag assigned to the chunks and correct them based on later context.
Often, users express a positive or neutral opinion early in the conversation, but clarify deep frustration, challenges, or highly specific details later.
Review these chunks:
${JSON.stringify(chunks)}

For each chunk, evaluate if subsequent statements in the conversation would change its classification (Topic or Sentiment).
Output a JSON object containing:
- "corrections": an array of objects for ONLY those chunks that need correction, containing:
  - "chunkId": string
  - "text": string
  - "originalTopic": string
  - "originalSentiment": string
  - "correctedTopic": string
  - "correctedSentiment": string
  - "reasoning": a clear explanation of what changed in hindsight (e.g. "Respondent initially said setup was fine, but later revealed that the terminal crashed on the second step.")
- "verifiedChunks": the complete list of all chunks with their final classifications (incorporating your changes).

Complete Transcript:
${rawTranscript}`;

    onProgress?.("hindsight", 85, "Analyzing context shifts and resolving contradictions...");
    const hindsightText = await callNvidiaNim(apiKey, hindsightPrompt, "You apply retrospective context to revise early classification mistakes.", true);
    const hindsightData = JSON.parse(hindsightText);
    const corrections: HindsightCorrection[] = hindsightData.corrections || [];
    const verifiedChunks: ChunkClassification[] = hindsightData.verifiedChunks || chunks;
    onProgress?.("hindsight", 100, `Hindsight completed. Corrected ${corrections.length} misclassifications.`);

    // Stage 4: Synthesis & Output Generation
    onProgress?.("synthesis", 10, "Aggregating data into final structured executive report...");
    await new Promise(resolve => setTimeout(resolve, 1000));

    const synthesisPrompt = `Synthesize this feedback session into a premium Operator Dashboard output in JSON.
Generate:
1. "summary": a compelling, 3-sentence executive summary highlighting the main friction points and delightful moments.
2. "themes": an array of top theme objects, each with "title" (string), "count" (number of occurrences), "sentiment" ("positive", "negative", or "mixed"), and "description" (1-sentence summary of the theme).
3. "heatmap": an array of objects representing sentiment score per topic: "topic" (string), "score" (0 to 100 where 0=frustrated, 100=delighted), and "count" (number of chunks).
4. "highlights": 2-3 key verbatim quotes with "text" (string), "topic" (string), and "emotionalWeight" ("high", "medium", or "low").
5. "actions": 3-4 operator action items with "task" (concrete description), "priority" ("high", "medium", or "low"), and "category" (e.g. "Bug Fix", "Feature Request", "UI Polish").

Using the corrected chunks:
${JSON.stringify(verifiedChunks)}`;

    onProgress?.("synthesis", 50, "Synthesizing sentiment heatmap and extracting highlight reel...");
    const synthesisText = await callNvidiaNim(apiKey, synthesisPrompt, "You generate beautiful, actionable executive summaries and action items in JSON.", true);
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

function simulateInterviewerTurn(history: DialogueTurn[]): string {
  const userTurns = history.filter(h => h.role === "respondent");
  
  if (userTurns.length === 0) {
    return "Hey there! Thanks for taking the time to share your feedback. To get us started, what was your overall impression of the event or product?";
  }
  
  if (userTurns.length === 1) {
    const text = userTurns[0].text.toLowerCase();
    if (text.includes("okay") || text.includes("fine") || text.includes("good") || text.length < 20) {
      return "Thanks for that. You mentioned it was okay—was there a specific moment or feature that stood out as particularly good, or something that felt like a hurdle?";
    }
    return "Got it. That makes sense. Let's talk about the setup or onboarding process. How did that feel for you? Did you encounter any roadblocks?";
  }
  
  if (userTurns.length === 2) {
    const text = userTurns[1].text.toLowerCase();
    if (text.includes("error") || text.includes("bug") || text.includes("stuck") || text.includes("hard") || text.includes("slow")) {
      return "Oh, that sounds frustrating. Could you elaborate on what happened when you hit that roadblock, and how you eventually got past it?";
    }
    return "Excellent. Finally, if you could change just one thing to make this experience absolutely delightful, what would that be?";
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
  
  const cleanTranscript = history.map(h => ({
    ...h,
    text: h.text.replace(/\b(um|uh|like|so|basically)\b/gi, "").replace(/\s+/g, " ").trim()
  }));
  
  onProgress?.("clean", 100, `Cleaned transcript created with ${cleanTranscript.length} conversation turns.`);

  // Step 2: Chunking & Classification
  onProgress?.("extract", 20, "Segmenting transcript into atomic feedback chunks...");
  await new Promise(resolve => setTimeout(resolve, 600));
  onProgress?.("extract", 70, "Applying real-time topic modeling & sentiment weights...");
  await new Promise(resolve => setTimeout(resolve, 600));

  // Heuristic analysis of the transcript
  const userSpeech = history.filter(h => h.role === "respondent").map(h => h.text).join(" ");
  const userSpeechLower = userSpeech.toLowerCase();

  const chunks: ChunkClassification[] = [];
  
  // Generate chunks based on text matches
  let chunkCount = 1;
  const addChunk = (text: string, topic: string, sentiment: "positive" | "negative" | "neutral" | "ambivalent", intensity: "low" | "medium" | "high", specificity: number) => {
    chunks.push({
      id: `chunk_${chunkCount++}`,
      text,
      topic,
      sentiment,
      intensity,
      specificity
    });
  };

  // Find user sentences
  const sentences = userSpeech.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 5);
  
  if (sentences.length === 0) {
    addChunk("The experience was quite interesting and helpful.", "General", "positive", "medium", 2);
  } else {
    sentences.forEach((sentence, idx) => {
      const lower = sentence.toLowerCase();
      let topic = "General";
      let sentiment: "positive" | "negative" | "neutral" | "ambivalent" = "neutral";
      let intensity: "low" | "medium" | "high" = "medium";
      let specificity = 2;

      if (lower.includes("setup") || lower.includes("install") || lower.includes("onboard") || lower.includes("start")) {
        topic = "Onboarding";
        specificity = 3;
      } else if (lower.includes("ui") || lower.includes("ux") || lower.includes("dashboard") || lower.includes("look") || lower.includes("screen") || lower.includes("visual")) {
        topic = "UI/UX";
        specificity = 3;
      } else if (lower.includes("feature") || lower.includes("api") || lower.includes("tool") || lower.includes("widget")) {
        topic = "Features";
        specificity = 4;
      } else if (lower.includes("price") || lower.includes("cost") || lower.includes("free")) {
        topic = "Pricing";
        specificity = 4;
      }

      if (lower.includes("great") || lower.includes("awesome") || lower.includes("delightful") || lower.includes("love") || lower.includes("easy") || lower.includes("good")) {
        sentiment = "positive";
        if (lower.includes("love") || lower.includes("awesome")) intensity = "high";
      } else if (lower.includes("error") || lower.includes("crash") || lower.includes("hard") || lower.includes("difficult") || lower.includes("annoying") || lower.includes("bad") || lower.includes("quit") || lower.includes("frustrated")) {
        sentiment = "negative";
        intensity = "high";
        specificity += 1;
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
        reasoning: "Respondent initially stated onboarding was 'fine', but later detailed significant setup issues and errors. Hindsight reveals early sentiment was polite compliance, and the overall experience was highly ambivalent."
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
        reasoning: "General complaint about 'the dashboard' is resolved in hindsight to represent the specific sub-screens of the Analytics Panel, following later mentions of charts."
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
    overallSummary = "The feedback session reveals severe onboarding barriers and functional errors. While the user appreciates the visual design, they were unable to successfully complete their primary goals due to setup complications.";
  } else if (positiveCount > 3) {
    overallSummary = "An exceptionally delightful session! The user expressed highly positive sentiment towards the conversational nature of the product and found onboarding seamless, only suggesting minor improvements to export filters.";
  }

  const synthesis: SynthesisOutput = {
    summary: overallSummary,
    themes: [
      {
        title: "Setup Friction",
        count: userSpeechLower.includes("setup") || userSpeechLower.includes("install") ? 2 : 1,
        sentiment: userSpeechLower.includes("error") ? "negative" : "mixed",
        description: "Initial environment scripts failed or felt overly complex to configure."
      },
      {
        title: "Conversational Widget UX",
        count: 2,
        sentiment: "positive",
        description: "The microphone-driven interface is highly intuitive and 3x faster than writing."
      },
      {
        title: "Analytics Depth",
        count: userSpeechLower.includes("analytics") || userSpeechLower.includes("chart") ? 1 : 0,
        sentiment: "neutral",
        description: "Operator requires clearer data breakdowns and chart export functionalities."
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
        task: "Simplify onboarding terminal scripts and supply Docker stubs",
        priority: userSpeechLower.includes("error") ? "high" : "medium",
        category: "Onboarding"
      },
      {
        task: "Increase touch targets on the browser widget microphone button",
        priority: "medium",
        category: "UI/UX"
      },
      {
        task: "Add PDF/CSV downloadable report options to the dashboard",
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
          { role: "interviewer", text: "How was your overall experience?", timestamp: "16:15:02" },
          { role: "respondent", text: "The setup was fine, really quick to get going.", timestamp: "16:15:15" },
          { role: "interviewer", text: "Great. Did you hit any hurdles during development?", timestamp: "16:15:20" },
          { role: "respondent", text: "Actually, later when we tried to deploy, the build crashed. The console gave a cryptic error, and we wasted like two hours debugging it. We almost quit the hackathon. It would have been good to have clear troubleshooting stubs.", timestamp: "16:15:55" },
          { role: "interviewer", text: "Oh, sorry to hear that. Any final thoughts on UI?", timestamp: "16:16:02" },
          { role: "respondent", text: "The dashboard UI is nice, especially the real-time analytics graphs.", timestamp: "16:16:20" }
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
            reasoning: "Respondent initially praised the setup as 'fine', but later revealed they spent two hours debugging a build crash and almost quit. In hindsight, onboarding is highly ambivalent and setup was not actually fine."
          },
          {
            chunkId: "c5",
            text: "The dashboard UI is nice, especially the real-time analytics graphs.",
            originalTopic: "UI/UX",
            originalSentiment: "positive",
            correctedTopic: "Analytics Panel",
            correctedSentiment: "positive",
            reasoning: "General 'dashboard UI' is resolved to 'Analytics Panel' in hindsight due to specific praise for the real-time analytics graphs."
          }
        ],
        synthesis: {
          summary: "Alex had an initially positive onboarding experience that was ruined by a critical build error during deployment, costing two hours of development time. Once resolved, he loved the real-time analytics visual display.",
          themes: [
            { title: "Critical Build Failures", count: 2, sentiment: "negative", description: "Deployments crashed with obscure console errors, draining team morale." },
            { title: "Beautiful Visual Charts", count: 1, sentiment: "positive", description: "Respondent loved the real-time graphing UI." }
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
            { task: "Fix deployment console stdout trapping to surface clean error logs", priority: "high", category: "Deployments" },
            { task: "Build a pre-deployment check checklist in the dashboard", priority: "medium", category: "UI/UX" }
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
          { role: "interviewer", text: "What did you think of the new CRM layout?", timestamp: "15:20:00" },
          { role: "respondent", text: "It looked okay on the screen.", timestamp: "15:20:10" },
          { role: "interviewer", text: "Okay, what stood out specifically?", timestamp: "15:20:15" },
          { role: "respondent", text: "The visual charts on the main page were a bit confusing actually. I couldn't find the email integration button at first until I read the docs. But once I got the email connected, the automated syncing was absolutely magical. It saved me a ton of time already.", timestamp: "15:21:00" },
          { role: "interviewer", text: "Glad the sync worked out. Any layout complaints?", timestamp: "15:21:10" },
          { role: "respondent", text: "Just make the main screen buttons larger.", timestamp: "15:21:25" }
        ],
        chunks: [
          { id: "s1", text: "It looked okay on the screen.", topic: "UI/UX", sentiment: "neutral", intensity: "low", specificity: 1 },
          { id: "s2", text: "The visual charts on the main page were a bit confusing actually.", topic: "UI/UX", sentiment: "negative", intensity: "medium", specificity: 3 },
          { id: "s3", text: "I couldn't find the email integration button at first until I read the docs.", topic: "Email Sync", sentiment: "negative", intensity: "medium", specificity: 4 },
          { id: "s4", text: "But once I got the email connected, the automated syncing was absolutely magical.", topic: "Email Sync", sentiment: "positive", intensity: "high", specificity: 4 },
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
            reasoning: "Respondent started with a safe 'okay' rating, but subsequent critiques revealed they found the charts confusing and buttons too small. Hindsight reweights this first turn as ambivalent."
          }
        ],
        synthesis: {
          summary: "Marcus felt the visual layout was okay but noted initial confusion with dashboard charts. While finding the email sync setup unintuitive, he described the feature's performance as 'magical' and highly efficient.",
          themes: [
            { title: "Email Sync Magic", count: 2, sentiment: "positive", description: "Automated email synchronization delivers outstanding time-savings." },
            { title: "Confusing Visual Charts", count: 1, sentiment: "negative", description: "Dashboard layout displays high visual complexity, confusing first-time operators." }
          ],
          heatmap: [
            { topic: "UI/UX", score: 55, count: 3 },
            { topic: "Email Sync", score: 70, count: 2 }
          ],
          highlights: [
            { text: "\"The automated syncing was absolutely magical. It saved me a ton of time.\"", topic: "Email Sync", emotionalWeight: "high" },
            { text: "\"The visual charts on the main page were a bit confusing actually.\"", topic: "UI/UX", emotionalWeight: "medium" }
          ],
          actions: [
            { task: "Restyle dashboard graphs with larger tooltips and less visual density", priority: "medium", category: "UI/UX" },
            { task: "Add a prompt or tool-tip next to the email integration button for discoverability", priority: "high", category: "Features" }
          ]
        }
      }
    }
  ];
}
