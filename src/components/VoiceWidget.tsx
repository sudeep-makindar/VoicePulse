import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, MicOff, Send, Volume2, VolumeX, AlertTriangle, ArrowRight, CornerDownLeft, RotateCcw } from "lucide-react";
import { DialogueTurn, getNextInterviewerTurn } from "../services/gemini";

interface VoiceWidgetProps {
  onSessionComplete: (history: DialogueTurn[]) => void;
  onCancel: () => void;
}

export default function VoiceWidget({ onSessionComplete, onCancel }: VoiceWidgetProps) {
  const [history, setHistory] = useState<DialogueTurn[]>([]);
  const [currentText, setCurrentText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeTurnText, setActiveTurnText] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [showTypingFallback, setShowTypingFallback] = useState(false);

  const recognitionRef = useRef<any>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // Initialize Speech Synthesis and start the interview
  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    
    // Start with the initial interviewer question
    const startInterview = async () => {
      const initialTurn: DialogueTurn = {
        role: "interviewer",
        text: "Hey there! Thanks for taking the time to share your feedback. To get us started, what was your overall impression of our event or product?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      setHistory([initialTurn]);
      speakText(initialTurn.text);
    };

    startInterview();

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  // Auto-scroll transcript to bottom
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, activeTurnText]);

  // Handle TTS Speaking
  const speakText = (text: string) => {
    if (!ttsEnabled || !synthRef.current) return;
    
    // Cancel active voices
    synthRef.current.cancel();
    setIsSpeaking(true);
    setIsListening(false);

    // Filter signals from prompt
    const cleanedText = text.replace("THANK_YOU_VOICEPULSE", "").trim();

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    
    // Try to find a premium English voice
    const voices = synthRef.current.getVoices();
    const premiumVoice = voices.find(
      v => (v.name.includes("Google") || v.name.includes("Natural")) && v.lang.startsWith("en")
    ) || voices.find(v => v.lang.startsWith("en"));

    if (premiumVoice) utterance.voice = premiumVoice;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      setIsSpeaking(false);
      // Auto-start listening once AI finished speaking
      startListening();
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    synthRef.current.speak(utterance);
  };

  // Setup Web Speech API recognition
  const startListening = () => {
    if (synthRef.current && synthRef.current.speaking) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setErrorMsg("Web Speech API not supported in this browser. Please use Typing Fallback.");
      setShowTypingFallback(true);
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsListening(true);
        setCurrentText("");
        setErrorMsg("");
      };

      rec.onresult = (event: any) => {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        
        setActiveTurnText(final || interim);
      };

      rec.onerror = (event: any) => {
        console.error("Speech Recognition Error:", event.error);
        if (event.error === "not-allowed") {
          setErrorMsg("Microphone permission denied. Switch to Typing Mode.");
          setShowTypingFallback(true);
        } else if (event.error !== "no-speech") {
          setErrorMsg(`Mic error: ${event.error}. Switch to manual input.`);
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (e: any) {
      console.error(e);
      setErrorMsg("Failed to start recording. Please try typing.");
      setShowTypingFallback(true);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  // Handle Submitting User Speech / Text
  const submitResponse = async (responseText: string) => {
    const cleanText = responseText.trim();
    if (!cleanText) return;

    stopListening();
    setActiveTurnText("");
    
    // Add user turn
    const userTurn: DialogueTurn = {
      role: "respondent",
      text: cleanText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedHistory = [...history, userTurn];
    setHistory(updatedHistory);
    setManualInput("");

    // Trigger AI thinking state
    setIsSpeaking(true);
    
    try {
      const nextTurnText = await getNextInterviewerTurn(updatedHistory);
      
      if (nextTurnText.includes("THANK_YOU_VOICEPULSE")) {
        // Conclude interview
        const finalAIQuestion = nextTurnText.replace("THANK_YOU_VOICEPULSE", "").trim() || "Awesome. We have gathered plenty of depth. Analyzing details now...";
        const finalTurn: DialogueTurn = {
          role: "interviewer",
          text: finalAIQuestion,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        
        setHistory(prev => [...prev, finalTurn]);
        speakText(finalTurn.text);
        
        // Auto wrap-up after speech finished or in 4 seconds
        setTimeout(() => {
          onSessionComplete([...updatedHistory, finalTurn]);
        }, 4500);
      } else {
        const nextTurn: DialogueTurn = {
          role: "interviewer",
          text: nextTurnText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setHistory(prev => [...prev, nextTurn]);
        speakText(nextTurn.text);
      }
    } catch (e) {
      console.error(e);
      setIsSpeaking(false);
    }
  };

  const handleMicToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleFinishEarly = () => {
    stopListening();
    if (synthRef.current) synthRef.current.cancel();
    
    // Ensure we have at least one user turn before analysis
    const hasRespondentTurn = history.some(h => h.role === "respondent");
    if (!hasRespondentTurn) {
      submitResponse("Everything was great, setup was simple, but visual analytics could be broader.");
    } else {
      onSessionComplete(history);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-brand-dark flex flex-col items-center justify-center p-6 select-none overflow-hidden">
      
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(200,255,0,0.03),transparent_60%)] pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-brand-acid/20 to-transparent" />

      {/* Header bar */}
      <div className="w-full max-w-4xl flex items-center justify-between border-b border-brand-acid/15 pb-4 mb-6 z-10">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-brand-acid rounded-full animate-ping" />
          <h2 className="text-xl font-display tracking-widest text-white">INTERVIEW_AGENT.LOG</h2>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className={`p-2 glass rounded-lg border transition-all ${ttsEnabled ? "text-brand-acid border-brand-acid/30" : "text-brand-muted border-white/5"}`}
            title="Toggle Voice Output"
          >
            {ttsEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          
          <button 
            onClick={() => setShowTypingFallback(!showTypingFallback)}
            className={`px-3 py-1 text-xs font-mono border rounded-md transition-all ${showTypingFallback ? "text-brand-acid border-brand-acid/30 bg-brand-acid/5" : "text-brand-muted border-white/5"}`}
          >
            {showTypingFallback ? "Use Audio" : "Use Keyboard"}
          </button>
          
          <button 
            onClick={onCancel}
            className="text-sm font-mono text-brand-muted hover:text-white transition-colors"
          >
            QUIT_SESSION
          </button>
        </div>
      </div>

      {/* Central Dialogue Hub */}
      <div className="w-full max-w-4xl flex-1 glass rounded-2xl border border-white/10 flex flex-col justify-between overflow-hidden relative mb-6">
        
        {/* Messages feed */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 scrollbar-thin">
          <AnimatePresence initial={false}>
            {history.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className={`flex w-full ${msg.role === "interviewer" ? "justify-start" : "justify-end"}`}
              >
                <div className={`max-w-[80%] rounded-2xl px-5 py-4 border ${
                  msg.role === "interviewer" 
                    ? "bg-brand-surface/40 border-white/5 text-white rounded-tl-none" 
                    : "bg-brand-acid/5 border-brand-acid/20 text-brand-acid rounded-tr-none"
                }`}>
                  <div className="flex items-center justify-between gap-12 mb-1 opacity-40 font-mono text-[10px]">
                    <span>{msg.role === "interviewer" ? "AI_INTERVIEWER" : "RESPONDENT"}</span>
                    <span>{msg.timestamp}</span>
                  </div>
                  <p className="font-body text-base leading-relaxed text-left">{msg.text}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Real-time speech transcription buffer */}
          {activeTurnText && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-end w-full"
            >
              <div className="max-w-[80%] rounded-2xl px-5 py-4 border border-brand-acid/10 bg-brand-acid/[0.02] text-brand-acid/70 italic rounded-tr-none">
                <div className="flex items-center gap-2 mb-1 opacity-40 font-mono text-[10px]">
                  <div className="w-1.5 h-1.5 bg-brand-acid rounded-full animate-ping" />
                  <span>TRANSCRIBING_LIVE...</span>
                </div>
                <p className="font-body text-base text-left">{activeTurnText}</p>
              </div>
            </motion.div>
          )}
          
          <div ref={historyEndRef} />
        </div>

        {/* Dynamic status banner */}
        <div className="bg-brand-dark/80 border-t border-white/5 px-6 py-3 flex items-center justify-between text-xs font-mono text-brand-muted">
          <div className="flex items-center gap-2">
            {isSpeaking ? (
              <>
                <Volume2 size={14} className="text-brand-acid animate-bounce" />
                <span className="text-brand-acid">AI is speaking...</span>
              </>
            ) : isListening ? (
              <>
                <div className="w-2 h-2 bg-brand-acid rounded-full animate-ping" />
                <span className="text-white">Active microphone—speak freely</span>
              </>
            ) : (
              <>
                <MicOff size={14} />
                <span>Microphone paused</span>
              </>
            )}
          </div>
          
          <div>
            Turns completed: {history.filter(h => h.role === "respondent").length} / 3
          </div>
        </div>
      </div>

      {/* Control Deck */}
      <div className="w-full max-w-4xl flex flex-col items-center gap-4 z-10">
        
        {/* Error notification */}
        {errorMsg && (
          <div className="flex items-center gap-2 text-red-400 font-mono text-xs border border-red-500/20 bg-red-950/20 px-4 py-2 rounded-lg">
            <AlertTriangle size={14} />
            <span>{errorMsg}</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {!showTypingFallback ? (
            // ================== AUDIO MODE INPUT ==================
            <motion.div 
              key="audio_mode"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-center justify-center gap-6 w-full py-4 relative"
            >
              {/* Waveform graphic Left */}
              <div className="hidden md:flex items-center gap-1.5 h-16 w-32 justify-end opacity-20">
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 bg-brand-acid rounded-full"
                    animate={isListening ? {
                      height: [10, 30 + Math.sin(i + Date.now()/100)*25, 10]
                    } : { height: 6 }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.08 }}
                  />
                ))}
              </div>

              {/* Immersive circular microphone */}
              <div className="relative group">
                <motion.div 
                  className={`absolute -inset-4 rounded-full blur-md opacity-30 transition-all ${isListening ? "bg-brand-acid/40 animate-pulse" : "bg-white/5"}`}
                />
                
                <motion.button
                  onClick={handleMicToggle}
                  disabled={isSpeaking}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`relative w-24 h-24 rounded-full flex items-center justify-center border-2 transition-all ${
                    isListening 
                      ? "bg-brand-acid text-brand-dark border-brand-acid shadow-[0_0_35px_rgba(200,255,0,0.4)]" 
                      : "bg-brand-surface text-white border-white/10 hover:border-brand-acid/50 hover:text-brand-acid"
                  } ${isSpeaking ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  {isListening ? <Mic size={38} className="animate-pulse" /> : <MicOff size={38} />}
                </motion.button>
              </div>

              {/* Waveform graphic Right */}
              <div className="hidden md:flex items-center gap-1.5 h-16 w-32 justify-start opacity-20">
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 bg-brand-acid rounded-full"
                    animate={isListening ? {
                      height: [10, 35 + Math.cos(i + Date.now()/100)*20, 10]
                    } : { height: 6 }}
                    transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.05 }}
                  />
                ))}
              </div>

              {/* Speak/Send Manual button when speech recognition buffer is active */}
              {activeTurnText && !isListening && (
                <button
                  onClick={() => submitResponse(activeTurnText)}
                  className="absolute right-12 px-5 py-3 border border-brand-acid bg-brand-acid/10 hover:bg-brand-acid hover:text-brand-dark text-brand-acid rounded-xl flex items-center gap-2 font-mono text-sm transition-all"
                >
                  CONFIRM_SPEECH <ArrowRight size={16} />
                </button>
              )}
            </motion.div>
          ) : (
            // ================== TYPING MODE INPUT ==================
            <motion.div
              key="typing_mode"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="w-full"
            >
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  submitResponse(manualInput);
                }}
                className="w-full flex items-center gap-3 bg-brand-surface/60 border border-white/10 rounded-xl p-2 focus-within:border-brand-acid/40 transition-all"
              >
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Type your feedback response here..."
                  className="flex-1 bg-transparent px-4 py-3 border-none outline-none font-body text-base text-white placeholder-brand-muted"
                  disabled={isSpeaking}
                />
                
                <button
                  type="submit"
                  disabled={isSpeaking || !manualInput.trim()}
                  className={`p-3 rounded-lg border flex items-center justify-center transition-all ${
                    manualInput.trim() && !isSpeaking
                      ? "bg-brand-acid border-brand-acid text-brand-dark cursor-pointer"
                      : "bg-white/5 border-transparent text-brand-muted cursor-not-allowed"
                  }`}
                >
                  <Send size={18} />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global actions row */}
        <div className="w-full flex justify-between items-center text-xs font-mono text-brand-muted mt-2">
          <div>
            {!showTypingFallback ? (
              <span>Tap microphone to toggle voice recording</span>
            ) : (
              <span>Type your thoughts and hit Enter</span>
            )}
          </div>
          
          <button 
            onClick={handleFinishEarly}
            className="px-4 py-2 border border-brand-acid/20 text-brand-acid bg-brand-acid/5 hover:bg-brand-acid hover:text-brand-dark transition-all rounded-lg cursor-pointer flex items-center gap-1.5"
          >
            FINISH_AND_RUN_CASCADEFLOW <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
