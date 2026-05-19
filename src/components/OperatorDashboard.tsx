import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  BarChart3, 
  Users, 
  CheckSquare, 
  AlertCircle, 
  RotateCcw, 
  MessageSquare, 
  Sparkles, 
  Key, 
  Trash2, 
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FileCheck,
  TrendingUp,
  Compass
} from "lucide-react";
import { 
  PipelineResult, 
  getApiKey, 
  saveApiKey, 
  HindsightCorrection, 
  ChunkClassification 
} from "../services/gemini";
import { AuthUserButton } from "./AuthGate";

interface OperatorDashboardProps {
  sessions: { id: string; name: string; context: string; timestamp: string; result: PipelineResult }[];
  onDeleteSession: (id: string) => void;
  onResetSeeds: () => void;
  onBackToLanding: () => void;
}

export default function OperatorDashboard({ sessions, onDeleteSession, onResetSeeds, onBackToLanding }: OperatorDashboardProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string>(sessions[0]?.id || "");
  const [apiKeyInput, setApiKeyInput] = useState(getApiKey());
  const [showKeyPanel, setShowKeyPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<"session" | "cluster">("session");
  const [expandedTranscript, setExpandedTranscript] = useState(false);

  // Active session helper
  const selectedSession = useMemo(() => {
    return sessions.find(s => s.id === selectedSessionId) || sessions[0];
  }, [sessions, selectedSessionId]);

  // Handle saving API key
  const handleSaveKey = () => {
    saveApiKey(apiKeyInput);
    setShowKeyPanel(false);
    alert("Gemini API key updated successfully! New sessions will run live.");
  };

  const handleClearKey = () => {
    saveApiKey("");
    setApiKeyInput("");
    setShowKeyPanel(false);
    alert("Gemini API key cleared. Swapped to simulation fallback engine.");
  };

  // Cross-session stats calculations
  const stats = useMemo(() => {
    if (sessions.length === 0) return { count: 0, avgSentiment: 0, totalCorrections: 0 };
    
    let totalScore = 0;
    let correctionCount = 0;
    
    sessions.forEach(s => {
      // Calculate average topic score
      const scores = s.result.synthesis.heatmap.map(h => h.score);
      const avg = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
      totalScore += avg;
      
      correctionCount += s.result.corrections.length;
    });

    return {
      count: sessions.length,
      avgSentiment: Math.round(totalScore / sessions.length),
      totalCorrections: correctionCount
    };
  }, [sessions]);

  // Global Multi-session Theme Aggregator (Mocked dynamic clustering)
  const globalThemes = useMemo(() => {
    const themesMap: { [key: string]: { count: number; sentiment: string; desc: string } } = {};
    
    sessions.forEach(s => {
      s.result.synthesis.themes.forEach(t => {
        if (themesMap[t.title]) {
          themesMap[t.title].count += 1;
        } else {
          themesMap[t.title] = { count: 1, sentiment: t.sentiment, desc: t.description };
        }
      });
    });

    return Object.entries(themesMap).map(([title, val]) => ({
      title,
      count: val.count,
      sentiment: val.sentiment,
      description: val.desc
    })).sort((a, b) => b.count - a.count);
  }, [sessions]);

  return (
    <div className="min-h-screen bg-brand-dark text-white p-6 sm:p-12 selection:bg-brand-acid selection:text-brand-dark">
      
      {/* Background Grids */}
      <div className="absolute inset-0 opacity-[0.01] pointer-events-none" style={{ 
        backgroundImage: "linear-gradient(rgba(200, 255, 0, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(200, 255, 0, 0.5) 1px, transparent 1px)", 
        backgroundSize: "40px 40px" 
      }} />

      <header className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-brand-acid/15 pb-8 mb-12">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBackToLanding}
            className="p-3 glass rounded-xl border border-white/5 hover:border-brand-acid/30 text-brand-muted hover:text-brand-acid transition-all"
            title="Back to Landing Page"
          >
            <ArrowLeft size={18} />
          </button>
          
          <div>
            <h1 className="text-4xl font-display tracking-wider text-white flex items-center gap-3">
              VOICEPULSE <span className="text-sm font-mono text-brand-acid border border-brand-acid/30 px-3 py-1 rounded bg-brand-acid/5 tracking-normal">OPERATOR CONSOLE</span>
            </h1>
            <p className="text-brand-muted font-body mt-1">Real-time Conversational Feedback Intelligence Hub</p>
          </div>
        </div>

        {/* API Key Panel and Auth controller */}
        <div className="flex items-center gap-4 flex-wrap justify-end">
          <AuthUserButton />

          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${getApiKey() ? "bg-emerald-500 animate-pulse" : "bg-yellow-500 animate-pulse"}`} />
            <span className="font-mono text-xs text-brand-muted">
              {getApiKey() ? "LIVE_GEMINI" : "SIMULATED_AI"}
            </span>
          </div>

          <button
            onClick={() => setShowKeyPanel(!showKeyPanel)}
            className="flex items-center gap-2 px-4 py-2 border border-brand-acid/20 hover:border-brand-acid/50 text-brand-acid bg-brand-acid/5 hover:bg-brand-acid/10 rounded-xl transition-all font-mono text-xs cursor-pointer"
          >
            <Key size={14} />
            <span>MANAGE_API_KEYS</span>
          </button>
          
          <button
            onClick={onResetSeeds}
            className="flex items-center gap-1.5 px-3 py-2 border border-white/10 hover:border-red-500/30 text-brand-muted hover:text-red-400 rounded-xl transition-all font-mono text-xs cursor-pointer"
            title="Reset default session seeds"
          >
            <RotateCcw size={12} />
            <span>RESET_SEEDS</span>
          </button>
        </div>
      </header>

      {/* API Key Modal Panel */}
      <AnimatePresence>
        {showKeyPanel && (
          <div className="fixed inset-0 z-50 bg-brand-dark/80 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md glass border border-brand-acid/30 rounded-2xl p-8 flex flex-col gap-6"
            >
              <div className="flex items-center gap-3 border-b border-brand-acid/10 pb-4">
                <Key className="text-brand-acid" />
                <h3 className="text-xl font-display text-white">CONFIGURE_API_INTEGRATION</h3>
              </div>
              
              <p className="text-xs text-brand-muted font-body leading-relaxed">
                By default, VoicePulse executes a highly sophisticated in-memory cognitive simulator to showcase CascadeFlow sequential logs and Hindsight overrides immediately.
                <br /><br />
                To experience genuine zero-bias intelligence, paste a Google Gemini API Key from Google AI Studio.
              </p>

              <div className="flex flex-col gap-2">
                <label className="font-mono text-[10px] text-brand-muted uppercase">Gemini Studio API Key</label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="bg-brand-dark border border-white/10 focus:border-brand-acid/40 rounded-xl px-4 py-3 text-white outline-none font-mono text-sm"
                />
              </div>

              <div className="flex justify-between items-center gap-4 mt-2">
                <button
                  onClick={handleClearKey}
                  disabled={!getApiKey()}
                  className="px-4 py-2 text-xs font-mono border border-red-500/20 text-red-400 hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  DEACTIVATE_KEY
                </button>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowKeyPanel(false)}
                    className="px-4 py-2 text-xs font-mono text-brand-muted hover:text-white"
                  >
                    CLOSE
                  </button>
                  <button
                    onClick={handleSaveKey}
                    className="px-5 py-2 text-xs font-mono bg-brand-acid text-brand-dark font-bold rounded-xl hover:shadow-[0_0_20px_rgba(200,255,0,0.3)] transition-all"
                  >
                    SAVE_KEY
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        
        {/* ================== ANLYTICS METRICS BLOCK ================== */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="glass border border-white/5 p-6 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono text-brand-muted uppercase">TOTAL_SESSIONS</div>
              <div className="text-4xl font-display text-white mt-2">{stats.count}</div>
            </div>
            <Users size={32} className="text-brand-acid opacity-30" />
          </div>

          <div className="glass border border-white/5 p-6 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono text-brand-muted uppercase">AVG_SENTIMENT</div>
              <div className="text-4xl font-display text-brand-acid mt-2">{stats.avgSentiment}%</div>
            </div>
            <TrendingUp size={32} className="text-brand-acid opacity-30" />
          </div>

          <div className="glass border border-white/5 p-6 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono text-brand-muted uppercase">HINDSIGHT_REVISIONS</div>
              <div className="text-4xl font-display text-purple-400 mt-2">{stats.totalCorrections}</div>
            </div>
            <RotateCcw size={32} className="text-purple-400 opacity-30 animate-pulse" />
          </div>

          <div className="glass border border-white/5 p-6 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono text-brand-muted uppercase">PIPELINE_STATUS</div>
              <div className="text-xs font-mono text-emerald-400 mt-4 flex items-center gap-1.5">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                ONLINE // v4.2
              </div>
            </div>
            <Sparkles size={32} className="text-emerald-400 opacity-30" />
          </div>
        </section>

        {/* View Toggle Tabs */}
        <div className="flex border-b border-white/5 pb-0">
          <button
            onClick={() => setActiveTab("session")}
            className={`px-6 py-3 font-mono text-xs border-b-2 transition-all ${
              activeTab === "session" 
                ? "border-brand-acid text-brand-acid font-bold bg-brand-acid/[0.02]" 
                : "border-transparent text-brand-muted hover:text-white"
            }`}
          >
            RESPONDENTS_FEED ({sessions.length})
          </button>
          <button
            onClick={() => setActiveTab("cluster")}
            className={`px-6 py-3 font-mono text-xs border-b-2 transition-all ${
              activeTab === "cluster" 
                ? "border-brand-acid text-brand-acid font-bold bg-brand-acid/[0.02]" 
                : "border-transparent text-brand-muted hover:text-white"
            }`}
          >
            GLOBAL_THEME_CLUSTERING ({globalThemes.length})
          </button>
        </div>

        {activeTab === "cluster" ? (
          // ================== GLOBAL CLUSTERING VIEW ==================
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            <div className="lg:col-span-2 glass border border-white/5 p-8 rounded-2xl flex flex-col gap-6">
              <h3 className="text-2xl font-display text-white">CROSS-SESSION INSIGHT CLUSTERS</h3>
              <p className="text-sm text-brand-muted font-body">
                VoicePulse cross-references extracted feedback units across all completed interviews to cluster patterns and isolate core system concerns.
              </p>

              <div className="flex flex-col gap-4">
                {globalThemes.map((theme, i) => (
                  <div key={i} className="glass p-5 rounded-xl border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-brand-acid/20 transition-all">
                    <div>
                      <div className="flex items-center gap-3">
                        <h4 className="text-lg font-bold text-white">{theme.title}</h4>
                        <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded border ${
                          theme.sentiment === "positive" 
                            ? "text-emerald-400 border-emerald-500/20 bg-emerald-950/20"
                            : theme.sentiment === "negative"
                            ? "text-red-400 border-red-500/20 bg-red-950/20"
                            : "text-yellow-400 border-yellow-500/20 bg-yellow-950/20"
                        }`}>
                          {theme.sentiment}
                        </span>
                      </div>
                      <p className="text-sm text-brand-muted mt-1 leading-relaxed">{theme.description}</p>
                    </div>

                    <div className="flex flex-col items-end flex-shrink-0">
                      <span className="text-2xl font-display text-brand-acid">{theme.count}</span>
                      <span className="text-[10px] font-mono text-brand-muted">RESPONDENTS</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass border border-white/5 p-8 rounded-2xl flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-acid/5 rounded-full blur-3xl pointer-events-none" />
              
              <div>
                <Compass className="text-brand-acid mb-6 animate-pulse" size={38} />
                <h3 className="text-2xl font-display text-white mb-4">RECOMMENDED ACTIONS</h3>
                <p className="text-sm text-brand-muted font-body leading-relaxed mb-6">
                  Based on global semantic density clustering, the AI recommends focusing on:
                  <br /><br />
                  1. **Setup scripts stability**: The main deployment hurdles are generating neutral-negative loops.
                  <br />
                  2. **Micro-copy tooltips**: Discoverability of integration tools is causing UI delays.
                </p>
              </div>

              <div className="bg-brand-acid/5 border border-brand-acid/20 p-4 rounded-xl font-mono text-[10px] text-brand-acid flex items-center gap-2">
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>Aggregated themes live update as you speak more sessions.</span>
              </div>
            </div>
          </motion.div>
        ) : (
          // ================== GRANULAR RESPONDENT FEED VIEW ==================
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Col: Sessions List (4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-4 max-h-[85vh] overflow-y-auto scrollbar-thin pr-2">
              {sessions.length === 0 ? (
                <div className="glass border border-dashed border-white/10 p-8 text-center text-brand-muted rounded-2xl font-mono text-sm">
                  NO_ACTIVE_FEEDBACK_SESSIONS
                </div>
              ) : (
                sessions.map((sess) => {
                  const isSelected = sess.id === selectedSessionId;
                  const scores = sess.result.synthesis.heatmap.map(h => h.score);
                  const averageScore = Math.round(scores.reduce((a,b)=>a+b, 0)/(scores.length || 1));
                  
                  return (
                    <div 
                      key={sess.id}
                      onClick={() => setSelectedSessionId(sess.id)}
                      className={`glass p-5 rounded-2xl border text-left cursor-pointer transition-all flex flex-col gap-3 relative ${
                        isSelected 
                          ? "border-brand-acid bg-brand-acid/[0.03] shadow-[0_0_20px_rgba(200,255,0,0.05)]" 
                          : "border-white/5 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-base font-bold text-white truncate max-w-[70%]">{sess.name}</h4>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          averageScore > 75 
                            ? "bg-emerald-950/40 text-emerald-400 border border-emerald-500/20"
                            : averageScore > 50 
                            ? "bg-yellow-950/40 text-yellow-400 border border-yellow-500/20"
                            : "bg-red-950/40 text-red-400 border border-red-500/20"
                        }`}>
                          {averageScore}% SATIS
                        </span>
                      </div>

                      <p className="text-xs font-body text-brand-muted line-clamp-2 leading-relaxed">
                        {sess.result.synthesis.summary}
                      </p>

                      <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-1 font-mono text-[9px] text-brand-muted">
                        <span>{sess.timestamp}</span>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <RotateCcw size={10} className="text-purple-400" />
                            {sess.result.corrections.length} revisions
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("Are you sure you want to purge this session?")) {
                                onDeleteSession(sess.id);
                              }
                            }}
                            className="text-brand-muted hover:text-red-400 p-1 rounded hover:bg-white/5 transition-all"
                            title="Purge session record"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right Col: Deep Details (8 cols) */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {selectedSession ? (
                <motion.div 
                  key={selectedSession.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col gap-8"
                >
                  
                  {/* Summary & Header Block */}
                  <div className="glass p-8 rounded-3xl border border-white/5 relative overflow-hidden flex flex-col gap-4">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-brand-acid/5 rounded-full blur-3xl pointer-events-none" />
                    
                    <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-4 gap-4">
                      <div>
                        <div className="text-[10px] font-mono text-brand-acid tracking-wider">RESPONDENT_PROFILE</div>
                        <h2 className="text-3xl font-display text-white mt-1 uppercase">{selectedSession.name}</h2>
                        <div className="text-xs font-mono text-brand-muted mt-0.5">{selectedSession.context}</div>
                      </div>
                      
                      <div className="text-right font-mono text-xs text-brand-muted flex flex-col items-start md:items-end">
                        <span>RECORDED: {selectedSession.timestamp}</span>
                        <span className="text-brand-acid border border-brand-acid/30 px-2 py-0.5 mt-1 rounded bg-brand-acid/5 text-[10px]">
                          CASCADEFLOW COMPLETE
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-mono text-brand-muted uppercase mb-2">Executive Summary</div>
                      <p className="text-base text-white/90 font-body leading-relaxed text-left">
                        {selectedSession.result.synthesis.summary}
                      </p>
                    </div>
                  </div>

                  {/* Accordian Transcript */}
                  <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                    <button
                      onClick={() => setExpandedTranscript(!expandedTranscript)}
                      className="w-full px-6 py-4 flex items-center justify-between bg-brand-surface/10 hover:bg-brand-surface/20 transition-all font-mono text-xs text-white"
                    >
                      <span className="flex items-center gap-2">
                        <MessageSquare size={14} className="text-brand-acid" />
                        CLEANED_CONVERSATION_TRANSCRIPT.LOG
                      </span>
                      {expandedTranscript ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    
                    <AnimatePresence>
                      {expandedTranscript && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: "auto" }}
                          exit={{ height: 0 }}
                          className="overflow-hidden bg-brand-dark/20 border-t border-white/5"
                        >
                          <div className="p-6 flex flex-col gap-4 font-mono text-[11px] leading-relaxed max-h-72 overflow-y-auto scrollbar-thin">
                            {selectedSession.result.cleanTranscript.map((turn, i) => (
                              <div key={i} className={`flex flex-col gap-1 border-l-2 pl-3 py-1 ${turn.role === 'interviewer' ? 'border-brand-acid/30 text-white/65' : 'border-brand-acid text-brand-acid'}`}>
                                <div className="flex items-center gap-2 opacity-40 text-[9px]">
                                  <span>{turn.role.toUpperCase()}</span>
                                  <span>{turn.timestamp}</span>
                                </div>
                                <p className="text-left font-body text-sm leading-relaxed">{turn.text}</p>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* ================== HINDSIGHT CORRECTIONS BLOCK ================== */}
                  <div className="glass p-8 rounded-3xl border border-purple-500/25 bg-purple-950/[0.02] flex flex-col gap-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl pointer-events-none animate-pulse" />
                    
                    <div className="flex items-center justify-between border-b border-purple-500/20 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-950/40 border border-purple-500/30 flex items-center justify-center text-purple-400">
                          <RotateCcw size={16} />
                        </div>
                        <div>
                          <h3 className="text-xl font-display text-white">HINDSIGHT RETROSPECTIVE ADJUSTMENTS</h3>
                          <p className="text-[10px] font-mono text-purple-400">STAGE 5 COGNITIVE RE-TAGGING // FULL CONTEXT SCANNING</p>
                        </div>
                      </div>
                      
                      <span className="font-mono text-[10px] border border-purple-500/30 bg-purple-950/30 px-3 py-1 rounded text-purple-400">
                        {selectedSession.result.corrections.length} shifts resolved
                      </span>
                    </div>

                    {selectedSession.result.corrections.length === 0 ? (
                      <div className="text-center py-6 text-brand-muted font-mono text-xs flex flex-col items-center gap-2">
                        <FileCheck className="text-purple-400/50" size={32} />
                        <span>Hindsight verified: Initial classifications are 100% accurate in retrospect.</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {selectedSession.result.corrections.map((corr, i) => (
                          <div key={i} className="glass border border-purple-500/15 p-5 rounded-2xl flex flex-col gap-3 hover:border-purple-500/30 transition-all text-left">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-white/5 pb-2">
                              <span className="font-bold text-white text-sm">"{corr.text}"</span>
                              
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-[10px] font-mono text-red-400/60 line-through">
                                  {corr.originalTopic || "General"}: {corr.originalSentiment.toUpperCase()}
                                </span>
                                <span className="text-xs text-purple-400 font-bold">&gt;&gt;</span>
                                <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 bg-emerald-950/20">
                                  {corr.correctedTopic || "General"}: {corr.correctedSentiment.toUpperCase()}
                                </span>
                              </div>
                            </div>
                            
                            <p className="text-xs font-body text-purple-200 leading-relaxed">
                              <span className="font-mono text-purple-400 text-[10px] uppercase font-bold mr-1.5">[REASONING]</span>
                              {corr.reasoning}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Grid Bottom: Sentiment Heatmap + Action Checklist */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Heatmap Sentiment */}
                    <div className="glass p-6 rounded-2xl border border-white/5 flex flex-col gap-6 text-left">
                      <h4 className="text-lg font-display text-white border-b border-white/5 pb-3">SEMANTIC HEATMAP BY TOPIC</h4>
                      
                      <div className="flex flex-col gap-4">
                        {selectedSession.result.synthesis.heatmap.map((heat, i) => {
                          const isGreen = heat.score > 70;
                          const isRed = heat.score < 45;
                          
                          return (
                            <div key={i} className="flex flex-col gap-1.5">
                              <div className="flex items-center justify-between font-mono text-[10px]">
                                <span className="text-white">{heat.topic}</span>
                                <span className={isGreen ? "text-emerald-400" : isRed ? "text-red-400" : "text-yellow-400"}>
                                  {heat.score}% ({heat.count} chunks)
                                </span>
                              </div>
                              
                              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    isGreen ? "bg-emerald-400" : isRed ? "bg-red-400" : "bg-yellow-400"
                                  }`}
                                  style={{ width: `${heat.score}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Actions List */}
                    <div className="glass p-6 rounded-2xl border border-white/5 flex flex-col gap-6 text-left">
                      <h4 className="text-lg font-display text-white border-b border-white/5 pb-3">SYNTHESIZED ACTION CHECKLIST</h4>
                      
                      <div className="flex flex-col gap-3 max-h-64 overflow-y-auto scrollbar-thin">
                        {selectedSession.result.synthesis.actions.map((act, i) => (
                          <div key={i} className="flex items-start gap-3 p-2.5 hover:bg-white/[0.02] rounded-lg transition-all group">
                            <input 
                              type="checkbox" 
                              className="mt-1 accent-brand-acid w-4 h-4 cursor-pointer"
                              id={`act_${i}`}
                            />
                            
                            <label htmlFor={`act_${i}`} className="flex-1 text-xs font-body leading-relaxed text-white/90 group-hover:text-white transition-colors cursor-pointer select-none">
                              {act.task}
                              <div className="flex items-center gap-2 mt-1.5 font-mono text-[9px] text-brand-muted">
                                <span className={`uppercase font-bold ${
                                  act.priority === "high" ? "text-red-400" : act.priority === "medium" ? "text-yellow-400" : "text-brand-muted"
                                }`}>
                                  {act.priority} priority
                                </span>
                                <span>•</span>
                                <span className="uppercase text-brand-acid/70">{act.category}</span>
                              </div>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* Verbatim Highlights */}
                  <div className="glass p-8 rounded-3xl border border-white/5 flex flex-col gap-6 text-left">
                    <h4 className="text-lg font-display text-white border-b border-white/5 pb-3 uppercase">Verbatim Highlight Reel</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {selectedSession.result.synthesis.highlights.map((high, i) => (
                        <div key={i} className="glass p-5 rounded-2xl border border-white/5 bg-brand-surface/20 flex flex-col justify-between gap-4">
                          <p className="text-base font-body italic text-white/90 leading-relaxed font-semibold">
                            {high.text}
                          </p>
                          
                          <div className="flex items-center justify-between font-mono text-[9px] text-brand-muted pt-2 border-t border-white/5">
                            <span className="uppercase text-brand-acid">{high.topic}</span>
                            <span className="uppercase flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-brand-acid animate-ping" />
                              {high.emotionalWeight} EMOTIONAL_WEIGHT
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </motion.div>
              ) : (
                <div className="glass p-12 text-center text-brand-muted font-mono rounded-2xl border border-white/5">
                  SELECT_RESPONDENT_TO_VIEW_Payload
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
