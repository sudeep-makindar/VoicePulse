import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Layers, Terminal, Sparkles, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import { PipelineResult } from "../services/gemini";

interface CascadeFlowConsoleProps {
  logs: { stage: string; progress: number; log: string }[];
  currentStage: "clean" | "extract" | "hindsight" | "synthesis" | "done";
  onAnimationFinished: () => void;
}

export default function CascadeFlowConsole({ logs, currentStage, onAnimationFinished }: CascadeFlowConsoleProps) {
  const [displayedLogs, setDisplayedLogs] = useState<string[]>([]);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Sync incoming logs with local array
  useEffect(() => {
    if (logs.length > 0) {
      const latestLog = logs[logs.length - 1];
      const logLine = `[${latestLog.stage.toUpperCase()}] ${latestLog.log}`;
      setDisplayedLogs(prev => {
        // Prevent duplicate logs
        if (prev.length > 0 && prev[prev.length - 1] === logLine) return prev;
        return [...prev, logLine];
      });
    }
  }, [logs]);

  // Handle final pipeline completion trigger
  useEffect(() => {
    if (currentStage === "done") {
      setDisplayedLogs(prev => [...prev, "SYSTEM_STATUS: CascadeFlow sequential analysis COMPLETE.", "ACCESS_GRANTED: Dispatching payloads to Operator Dashboard..."]);
      const timer = setTimeout(onAnimationFinished, 1800);
      return () => clearTimeout(timer);
    }
  }, [currentStage, onAnimationFinished]);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayedLogs]);

  // Stage names for step sidebar
  const stages = [
    { key: "clean", name: "1. Clean Transcript" },
    { key: "extract", name: "2. Real-Time Extract" },
    { key: "hindsight", name: "3. Hindsight Reasoner" },
    { key: "synthesis", name: "4. Report Synthesis" },
  ];

  return (
    <div className="fixed inset-0 z-40 bg-brand-dark flex flex-col items-center justify-center p-6 md:p-12 overflow-hidden">
      
      {/* Background grids */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ 
        backgroundImage: "linear-gradient(rgba(200, 255, 0, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(200, 255, 0, 0.5) 1px, transparent 1px)", 
        backgroundSize: "40px 40px" 
      }} />

      {/* Radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-brand-acid/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-5xl aspect-[16/10] glass border border-brand-acid/20 rounded-2xl flex flex-col overflow-hidden shadow-[0_0_40px_rgba(200,255,0,0.05)]">
        
        {/* Terminal Header */}
        <div className="bg-brand-dark/90 border-b border-brand-acid/20 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-acid/10 border border-brand-acid/20 flex items-center justify-center text-brand-acid">
              <Layers size={18} className="animate-spin" style={{ animationDuration: '4s' }} />
            </div>
            
            <div>
              <h1 className="text-lg font-display tracking-widest text-white">CASCADEFLOW_PIPELINE.EXE</h1>
              <p className="text-[10px] font-mono text-brand-acid/70">SEQUENCE ACTIVE // MULTI-STAGE COGNITIVE RUNTIME</p>
            </div>
          </div>
          
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/40" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/40" />
            <span className="w-3 h-3 rounded-full bg-brand-acid/20 border border-brand-acid/40" />
          </div>
        </div>

        {/* Layout Grid */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Sidebar Step Indicators */}
          <div className="w-72 border-r border-white/5 bg-brand-surface/20 p-6 flex flex-col gap-6 font-mono text-xs">
            <div className="text-[10px] tracking-wider text-brand-muted uppercase mb-2">Processing Layers</div>
            
            {stages.map((stg) => {
              const isPast = stages.findIndex(s => s.key === stg.key) < stages.findIndex(s => s.key === currentStage);
              const isActive = stg.key === currentStage;
              const isDone = currentStage === "done";
              
              return (
                <div key={stg.key} className="flex flex-col gap-2">
                  <div className={`flex items-center justify-between p-3 border rounded-xl transition-all ${
                    isActive 
                      ? "bg-brand-acid/15 border-brand-acid/40 text-brand-acid shadow-[0_0_15px_rgba(200,255,0,0.06)]"
                      : isPast || isDone
                      ? "bg-white/[0.02] border-white/5 text-brand-muted"
                      : "border-transparent text-white/20"
                  }`}>
                    <span>{stg.name}</span>
                    {isActive ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : isPast || isDone ? (
                      <CheckCircle size={14} className="text-brand-acid" />
                    ) : null}
                  </div>

                  {/* Micro timeline bars */}
                  {stg.key !== "synthesis" && (
                    <div className="w-full flex justify-center py-1">
                      <div className={`w-[2px] h-4 transition-all ${isPast || isDone ? "bg-brand-acid/30" : "bg-white/5"}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Main Console Output */}
          <div className="flex-1 flex flex-col bg-brand-dark/30 font-mono text-xs overflow-hidden relative">
            
            {/* Scrollable logs */}
            <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-3 scrollbar-thin">
              <div className="text-white/30 text-[10px] border-b border-white/5 pb-2 mb-2">
                VOICEPULSE COGNITIVE ANALYSIS SERVICE — INITIALIZED SYSTEM BOOT
              </div>
              
              {displayedLogs.map((log, index) => {
                const isHindsightCorrection = log.includes("[HINDSIGHT]") && log.toLowerCase().includes("corrected");
                
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15 }}
                    className={`leading-relaxed text-left ${
                      log.startsWith("[SYSTEM") 
                        ? "text-brand-acid font-bold" 
                        : log.startsWith("[HINDSIGHT")
                        ? "text-purple-400"
                        : log.startsWith("[CLEAN")
                        ? "text-cyan-400"
                        : log.startsWith("[EXTRACT")
                        ? "text-blue-400"
                        : log.startsWith("[SYNTHESIS")
                        ? "text-emerald-400"
                        : "text-white/70"
                    } ${isHindsightCorrection ? "bg-purple-950/20 border border-purple-500/20 p-3 rounded-lg" : ""}`}
                  >
                    <span className="opacity-30 mr-2">&gt;</span>
                    {log}
                  </motion.div>
                );
              })}
              <div ref={consoleEndRef} />
            </div>

            {/* Stage bottom progress bar */}
            <div className="h-1 bg-white/5 w-full relative">
              <motion.div 
                className="absolute top-0 bottom-0 left-0 bg-brand-acid shadow-[0_0_10px_#C8FF00]"
                animate={{
                  width: 
                    currentStage === "clean" ? "25%" : 
                    currentStage === "extract" ? "50%" : 
                    currentStage === "hindsight" ? "75%" : 
                    currentStage === "synthesis" ? "95%" : 
                    "100%"
                }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
