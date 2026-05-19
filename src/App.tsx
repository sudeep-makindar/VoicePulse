/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, useScroll, useTransform, AnimatePresence } from "motion/react";
import React, { useEffect, useState, useRef } from "react";
import { 
  Mic, 
  Layers, 
  RotateCcw, 
  BarChart3, 
  ArrowRight, 
  ChevronLeft, 
  ChevronRight,
  Database,
  Cpu,
  Fingerprint,
  Zap
} from "lucide-react";

// VoicePulse Subcomponents & Services
import VoiceWidget from "./components/VoiceWidget";
import CascadeFlowConsole from "./components/CascadeFlowConsole";
import OperatorDashboard from "./components/OperatorDashboard";
import AuthGate from "./components/AuthGate";
import { 
  DialogueTurn, 
  PipelineResult, 
  runCascadeFlowPipeline, 
  getSeedSessions 
} from "./services/gemini";
import { recordSessionToSheet } from "./services/sheets";

// --- Original Graphic Components ---

const LoadingScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(onComplete, 500);
          return 100;
        }
        return prev + 1;
      });
    }, 15);
    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <motion.div 
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-brand-dark overflow-hidden"
      exit={{ y: "-100%" }}
      transition={{ duration: 0.8, ease: [0.8, 0, 0.2, 1] }}
    >
      <div className="flex flex-col items-center">
        <motion.h1 
          className="text-6xl font-display tracking-widest mb-4"
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.1 } }
          }}
        >
          {"VOICEPULSE".split("").map((char, i) => (
            <motion.span 
              key={i}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
            >
              {char}
            </motion.span>
          ))}
        </motion.h1>
        
        <div className="w-64 h-12 flex items-center justify-center">
          <svg width="200" height="40" viewBox="0 0 200 40" className="animate-pulse">
            <path
              d="M 0 20 Q 25 5, 50 20 T 100 20 T 150 20 T 200 20"
              fill="transparent"
              stroke="#C8FF00"
              strokeWidth="2.5"
            />
          </svg>
        </div>
        
        <div className="font-mono text-brand-acid mt-4">{progress}%</div>
      </div>
      
      {/* Wipe overlays */}
      <motion.div 
        className="absolute top-0 left-0 w-full h-1/2 bg-brand-dark border-b border-brand-acid/20"
        exit={{ y: "-100%" }}
        transition={{ duration: 0.8, ease: [0.8, 0, 0.2, 1] }}
      />
      <motion.div 
        className="absolute bottom-0 left-0 w-full h-1/2 bg-brand-dark border-t border-brand-acid/20"
        exit={{ y: "100%" }}
        transition={{ duration: 0.8, ease: [0.8, 0, 0.2, 1] }}
      />
    </motion.div>
  );
};

const HeroSection = ({ onStart }: { onStart: () => void }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const { scrollY } = useScroll();
  
  const textY = useTransform(scrollY, [0, 500], [0, 150]);
  const orbY = useTransform(scrollY, [0, 500], [0, 300]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    setRotate({
      x: (y - centerY) / 15,
      y: -(x - centerX) / 15
    });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 px-6 sm:px-12 overflow-hidden">
      <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        
        <motion.div style={{ y: textY }} className="z-10 order-2 lg:order-1 text-left">
          <h1 className="text-7xl sm:text-9xl font-display leading-[0.8] tracking-tighter">
            <span className="block text-white">STOP FILLING</span>
            <span className="block text-brand-acid">FORMS. JUST TALK.</span>
          </h1>
          <p className="mt-8 text-xl text-brand-muted font-body max-w-lg">
            VoicePulse replaces your static surveys with a 90-second conversational AI interview. 
            Structured intelligence. Zero typing.
          </p>
          
          <div className="mt-12 flex items-center gap-6">
            <motion.button 
              onClick={onStart}
              className="relative px-8 py-4 bg-transparent border-2 border-brand-acid text-brand-acid font-bold tracking-widest overflow-hidden group cursor-pointer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="relative z-10 flex items-center gap-2">
                START TALKING <ArrowRight size={20} />
              </span>
              <div className="absolute inset-0 bg-brand-acid/10 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
              {/* Electric border effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-brand-acid via-transparent to-brand-acid opacity-30 blur-sm animate-pulse pointer-events-none" />
            </motion.button>
          </div>
        </motion.div>

        <div className="relative flex justify-center order-1 lg:order-2">
          {/* 3D Tilt Card */}
          <motion.div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={onStart}
            className="w-full max-w-md aspect-[4/5] glass rounded-2xl flex flex-col items-center justify-center p-8 cursor-pointer relative border border-white/5"
            animate={{ rotateX: rotate.x, rotateY: rotate.y }}
            transition={{ type: "spring", stiffness: 150, damping: 20 }}
            style={{ transformStyle: "preserve-3d", perspective: "1000px" }}
          >
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-brand-acid/25 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-brand-acid/15 rounded-full blur-[100px] pointer-events-none" />
            
            <div className="w-full h-1/2 flex items-end justify-center gap-1.5 mb-8">
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-2.5 bg-brand-acid rounded-full"
                  animate={{
                    height: [20, 70 + Math.random() * 45, 20]
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 0.5 + Math.random() * 0.5,
                    ease: "easeInOut",
                    delay: i * 0.08
                  }}
                />
              ))}
            </div>
            
            <div className="text-center" style={{ transform: "translateZ(50px)" }}>
              <div className="text-brand-acid font-mono text-xs tracking-widest mb-2 uppercase flex items-center justify-center gap-1.5">
                <div className="w-2 h-2 bg-brand-acid rounded-full animate-ping" />
                Audio Signal Active
              </div>
              <div className="text-3xl font-display text-white tracking-widest">WAVEFORM_01.EXE</div>
            </div>
          </motion.div>

          {/* 3D Orb */}
          <motion.div 
            style={{ y: orbY }}
            className="absolute -top-20 -right-20 pointer-events-none hidden xl:block"
          >
            <div className="relative w-80 h-80">
              <div className="absolute inset-0 border-2 border-brand-acid/30 rounded-full animate-[spin_10s_linear_infinite]" />
              <div className="absolute inset-4 border border-brand-acid/20 rounded-full animate-[spin_7s_linear_infinite_reverse]" />
              <div className="absolute inset-8 border-2 border-brand-acid/10 rounded-full animate-[spin_15s_linear_infinite]" />
              <div className="absolute inset-0 flex items-center justify-center">
                 <div className="w-4 h-4 bg-brand-acid rounded-full shadow-[0_0_30px_#C8FF00] animate-pulse" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
      
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 opacity-20 pointer-events-none">
        <div className="absolute top-0 right-0 w-full h-[1px] bg-gradient-to-l from-brand-acid to-transparent" />
        <div className="absolute top-0 right-0 h-full w-[1px] bg-gradient-to-b from-brand-acid to-transparent" />
      </div>
    </section>
  );
};

const HorizontalScrollSection = () => {
  const targetRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: targetRef,
  });

  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-52%"]);
  const progressLine = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  const steps = [
    { number: "01", title: "SPEAK", desc: "User opens VoicePulse, talks naturally.", icon: <Mic size={48} className="text-brand-acid" /> },
    { number: "02", title: "CASCADEFLOW", desc: "Sequence activates layers of abstractions.", icon: <Layers size={48} className="text-brand-acid" /> },
    { number: "03", title: "HINDSIGHT", desc: "Retrospective pass re-evaluates early biases.", icon: <RotateCcw size={48} className="text-brand-acid" /> },
    { number: "04", title: "INSIGHT", desc: "Metrics console generates checkable actions.", icon: <BarChart3 size={48} className="text-brand-acid" /> },
  ];

  return (
    <section ref={targetRef} className="relative h-[250vh] bg-brand-dark">
      <div className="sticky top-0 h-screen flex flex-col justify-center overflow-hidden">
        {/* Progress Bar */}
        <motion.div 
          className="absolute top-0 left-0 h-[2.5px] bg-brand-acid z-20"
          style={{ width: progressLine }}
        />
        
        <div className="px-12 sm:px-24 mb-16 text-left">
          <h2 className="text-5xl font-display tracking-wider text-white">HOW IT WORKS</h2>
          <p className="text-brand-muted font-body text-sm mt-1">Sequential abstraction layers process unstructured talk into checked lists</p>
        </div>

        <motion.div style={{ x }} className="flex gap-16 px-12 sm:px-24">
          {steps.map((step, i) => (
            <div key={i} className="relative flex-shrink-0 w-[80vw] lg:w-[450px] aspect-[4/5] glass rounded-3xl p-10 flex flex-col justify-between overflow-hidden border border-white/5">
              <div className="absolute -top-8 -right-8 text-[12rem] font-display text-brand-acid/5 pointer-events-none select-none">
                {step.number}
              </div>
              
              <div className="relative z-10 w-20 h-20 glass rounded-2xl flex items-center justify-center mb-12 border border-white/5">
                {step.icon}
              </div>
              
              <div className="relative z-10 text-left">
                <h3 className="text-4xl font-display text-white mb-4 tracking-wider">{step.title}</h3>
                <p className="text-brand-muted text-lg font-body leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

const PipelineSection = () => {
  const stages = [
    { title: "Transcription", desc: "Audio is mapped instantly into speaker transcripts.", icon: <Mic /> },
    { title: "Extraction", desc: "Core expressions segmented into focused text units.", icon: <Database /> },
    { title: "Chunking", desc: "Dialogue groups scored on topics & emotional specificity.", icon: <Layers /> },
    { title: "Entity Resolution", desc: "Mentions resolved against custom structural taxonomies.", icon: <Fingerprint /> },
    { title: "Hindsight Reasoning", desc: "Retrospective pass correcting tag classifications in context.", icon: <RotateCcw /> },
    { title: "Synthesis", desc: "Compiling checklists, priorities, summaries, and quotes.", icon: <Cpu /> },
  ];

  return (
    <section className="py-32 px-6 sm:px-12 bg-brand-dark overflow-hidden relative">
      <div className="max-w-7xl mx-auto">
        <div className="mb-24 text-center lg:text-left">
          <h2 className="text-5xl lg:text-7xl font-display text-white mb-4">THE CASCADEFLOW PIPELINE</h2>
          <p className="text-brand-acid font-mono tracking-widest">Six stages. No shortcuts. Every word contextualized.</p>
        </div>

        <div className="relative">
          {/* Vertical Timeline Line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-brand-acid/20 -translate-x-1/2 hidden lg:block" />
          
          <div className="flex flex-col gap-12 lg:gap-32">
            {stages.map((stage, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, rotateY: 90, x: i % 2 === 0 ? -100 : 100 }}
                whileInView={{ opacity: 1, rotateY: 0, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.05 }}
                className={`relative w-full lg:w-[45%] ${i % 2 === 0 ? 'lg:self-start' : 'lg:self-end'} glass p-8 rounded-2xl group border border-white/5 text-left`}
                style={{ transformStyle: "preserve-3d" }}
              >
                <div className="flex items-center gap-6 mb-4">
                  <div className="w-12 h-12 glass border border-brand-acid/30 rounded-lg flex items-center justify-center text-brand-acid">
                    {stage.icon}
                  </div>
                  <span className="font-mono text-brand-acid/50 text-xs">STAGE 0{i+1}</span>
                </div>
                <h3 className="text-3xl font-display text-white mb-2">{stage.title}</h3>
                <p className="text-brand-muted font-body leading-relaxed">{stage.desc}</p>
                
                {/* Connector Dot */}
                <div className={`absolute top-1/2 -translate-y-1/2 hidden lg:flex items-center justify-center w-6 h-6 bg-brand-dark border-2 border-brand-acid rounded-full z-20 ${i % 2 === 0 ? '-right-[calc(11.2%+12px)]' : '-left-[calc(11.2%+12px)]'}`}>
                  <div className="w-2 h-2 bg-brand-acid rounded-full animate-ping" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const FeatureSection = ({ onStart }: { onStart: () => void }) => {
  const features = [
    { title: "Voice-first collection", desc: "No more long keyboard chores. Givers simply click, talk, and done. 3x faster than forms.", speed: 0.2 },
    { title: "Hindsight reasoning", desc: "Adjusts early interview assumptions using later conversation clarifications automatically.", speed: 0.4 },
    { title: "Actionable dashboard", desc: "View corrected heatmaps, quotes, and checkbox lists sorted by priority in real-time.", speed: 0.6 },
  ];

  return (
    <section className="py-32 px-6 sm:px-12">
      <div className="max-w-7xl mx-auto grid grid-cols-1 gap-24">
        {features.map((f, i) => (
          <div key={i} className="relative grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-[50vh]">
            <motion.div
              initial={{ clipPath: "inset(0 100% 0 0)" }}
              whileInView={{ clipPath: "inset(0 0% 0 0)" }}
              transition={{ duration: 1, ease: "easeInOut" }}
              viewport={{ once: true }}
              className="order-2 lg:order-1 text-left"
            >
              <h2 className="text-6xl lg:text-8xl font-display text-white mb-6 uppercase leading-tight">{f.title}</h2>
              <p className="text-xl text-brand-muted font-body max-w-lg leading-relaxed">{f.desc}</p>
              
              <button 
                onClick={onStart}
                className="mt-8 font-mono text-brand-acid text-sm hover:underline cursor-pointer flex items-center gap-1.5"
              >
                TRY WIDGET FLOW <ArrowRight size={14} />
              </button>
            </motion.div>
            
            <motion.div 
              onClick={onStart}
              className="h-80 lg:h-full glass rounded-3xl overflow-hidden order-1 lg:order-2 flex items-center justify-center p-12 group border border-white/5 cursor-pointer"
              whileHover={{ scale: 1.02 }}
            >
              <div className="relative w-full h-full border border-brand-acid/10 rounded-2xl flex items-center justify-center bg-brand-surface/10">
                <div className="text-brand-acid/20 text-9xl font-display absolute inset-0 flex items-center justify-center select-none pointer-events-none">
                  {i + 1}
                </div>
                <Zap size={120} className="text-brand-acid opacity-30 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
            </motion.div>
          </div>
        ))}
      </div>
    </section>
  );
};

const UseCases = () => {
  const cases = [
    { name: "Hackathons", color: "#C8FF00", desc: "Gather instant project, speaker, and workshop friction levels live." },
    { name: "Product Teams", color: "#3B82F6", desc: "Test mock beta versions and get vocal logs without lengthy email surveys." },
    { name: "EdTech Classroom", color: "#EF4444", desc: "Ask students to voice explain hard formulas in post-lecture checkups." },
    { name: "HR Surveys", color: "#10B981", desc: "Conduct employee exit feedback cycles with deep contextual logic." },
    { name: "Patient Experience", color: "#F59E0B", desc: "Accessibility-first clinical intake procedures using natural conversations." },
  ];

  return (
    <section className="py-32 px-6 sm:px-12 bg-brand-surface/20">
      <div className="max-w-7xl mx-auto text-left">
        <h2 className="text-5xl font-display text-white mb-16">WHO USES VOICEPULSE?</h2>
        <div className="flex flex-col lg:flex-row h-auto lg:h-[400px] gap-4">
          {cases.map((c, i) => (
            <motion.div
              key={i}
              className="flex-1 min-h-[120px] lg:min-h-0 glass border border-white/5 rounded-2xl p-8 relative overflow-hidden group cursor-pointer text-left"
              whileHover={{ flex: 3 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                <h3 className="text-3xl font-display text-white">{c.name}</h3>
                <motion.p 
                  className="text-brand-muted text-sm leading-relaxed opacity-0 translate-y-10 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-75"
                >
                  {c.desc}
                </motion.p>
              </div>
              <div className="absolute inset-0 opacity-[0.03] group-hover:opacity-10 transition-opacity pointer-events-none" style={{ 
                backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, ${c.color} 10px, ${c.color} 20px)` 
              }} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const StatsCarousel = () => {
  const [index, setIndex] = useState(0);
  const stats = [
    { label: "FASTER FEEDBACK LOOP", value: "3x" },
    { label: "RICHER SEMANTIC DATA", value: "5x" },
    { label: "COGNITIVE STAGES", value: "6-STAGE" },
    { label: "COMPLETION RATIO", value: "94%" },
  ];

  const next = () => setIndex((i) => (i + 1) % stats.length);
  const prev = () => setIndex((i) => (i - 1 + stats.length) % stats.length);

  return (
    <section className="py-32 px-6 sm:px-12 bg-brand-dark overflow-hidden">
      <div className="max-w-5xl mx-auto flex flex-col items-center">
        <div className="relative h-80 w-full flex items-center justify-center" style={{ perspective: "1000px" }}>
          
          <AnimatePresence mode="wait">
             <motion.div
              key={index}
              initial={{ opacity: 0, rotateY: 90, scale: 0.8 }}
              animate={{ opacity: 1, rotateY: 0, scale: 1 }}
              exit={{ opacity: 0, rotateY: -90, scale: 0.8 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-lg aspect-video glass rounded-3xl border-2 border-brand-acid/40 flex flex-col items-center justify-center text-center p-12 bg-brand-surface/10"
            >
              <div className="text-8xl font-display text-brand-acid mb-4">{stats[index].value}</div>
              <div className="font-mono text-white text-xs tracking-[0.5em]">{stats[index].label}</div>
            </motion.div>
          </AnimatePresence>
          
          <button 
            onClick={prev}
            className="absolute left-0 lg:-left-20 top-1/2 -translate-y-1/2 w-12 h-12 glass border border-white/10 rounded-full flex items-center justify-center text-brand-acid hover:bg-brand-acid/10 transition-colors cursor-pointer"
          >
            <ChevronLeft size={32} />
          </button>
          <button 
            onClick={next}
            className="absolute right-0 lg:-right-20 top-1/2 -translate-y-1/2 w-12 h-12 glass border border-white/10 rounded-full flex items-center justify-center text-brand-acid hover:bg-brand-acid/10 transition-colors cursor-pointer"
          >
            <ChevronRight size={32} />
          </button>
        </div>
      </div>
    </section>
  );
};

const CTASection = ({ onStart }: { onStart: () => void }) => {
  return (
    <section className="py-64 px-6 sm:px-12 bg-brand-dark relative overflow-hidden">
      <div className="max-w-7xl mx-auto text-center">
        <motion.h2 
          className="text-[12vw] font-display text-white leading-none mb-12"
          initial={{ opacity: 0, y: 100 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
        >
          READY TO TALK?
        </motion.h2>
        
        <p className="text-2xl text-brand-muted font-body mb-12">
          Experience natural retrospective feedback logic in 90 seconds.
        </p>
        
        <motion.button 
          onClick={onStart}
          className="px-12 py-6 bg-transparent border-2 border-brand-acid text-brand-acid text-2xl font-display tracking-widest relative overflow-hidden group cursor-pointer"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="relative z-10 group-hover:text-brand-dark transition-colors duration-300">LAUNCH INTERVIEW NOW →</span>
          <div className="absolute inset-0 bg-brand-acid transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out" />
        </motion.button>
      </div>
      
      {/* Background scanlines */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ 
        backgroundImage: "linear-gradient(rgba(200, 255, 0, 0.5) 1px, transparent 1px)", 
        backgroundSize: "100% 4px" 
      }} />
    </section>
  );
};

const Footer = ({ onGoConsole }: { onGoConsole: () => void }) => {
  return (
    <footer className="py-12 px-6 sm:px-12 border-t border-brand-acid/25 flex flex-col md:flex-row justify-between items-center gap-8 bg-brand-dark">
      <div className="text-3xl font-display text-white">VOICEPULSE</div>
      
      <div className="flex gap-12 text-brand-muted font-mono text-sm">
        <button onClick={onGoConsole} className="hover:text-brand-acid transition-colors cursor-pointer">OPERATOR_CONSOLE</button>
        <a href="#" className="hover:text-brand-acid transition-colors">GEMINI_NIM_DOCS</a>
        <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-brand-acid transition-colors">GITHUB</a>
      </div>
      
      <div className="font-mono text-brand-acid/50 text-xs">
        BUILT FOR HACKATHON 2026 // SYSTEM OPERATIONAL
      </div>
    </footer>
  );
};

// --- Main App Controller ---

export default function App() {
  const [loading, setLoading] = useState(true);
  
  // App Mode State: 'landing' | 'interview' | 'pipeline' | 'dashboard'
  const [mode, setMode] = useState<"landing" | "interview" | "pipeline" | "dashboard">("landing");
  
  // CascadeFlow Orchestrator States
  const [pipelineLogs, setPipelineLogs] = useState<{ stage: string; progress: number; log: string }[]>([]);
  const [pipelineStage, setPipelineStage] = useState<"clean" | "extract" | "hindsight" | "synthesis" | "done">("clean");
  
  // Session Database State
  const [sessions, setSessions] = useState<{ id: string; name: string; context: string; timestamp: string; result: PipelineResult }[]>([]);

  // Active Campaign State
  const [campaignQuestions, setCampaignQuestions] = useState<string[]>(() => {
    const saved = localStorage.getItem("VOICEPULSE_CAMPAIGN_QUESTIONS");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      "What was your overall impression of the event or product?",
      "What specifically felt like a hurdle or roadblock during onboarding?",
      "If you could change just one thing to make this experience absolutely delightful, what would that be?"
    ];
  });

  // Initialize cursor animation and pre-load database seeds
  const cursorRef = useRef<HTMLDivElement>(null);
  const cursorRingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (cursorRef.current && cursorRingRef.current) {
        cursorRef.current.style.transform = `translate3d(${e.clientX - 10}px, ${e.clientY - 10}px, 0)`;
        cursorRingRef.current.style.transform = `translate3d(${e.clientX - 20}px, ${e.clientY - 20}px, 0)`;
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    
    // Load existing sessions or seed default ones
    const localData = localStorage.getItem("VOICEPULSE_SESSIONS_STORE_v2");
    if (localData) {
      try {
        setSessions(JSON.parse(localData));
      } catch (e) {
        console.error("Failed to load local storage sessions, seeding...", e);
        const seeds = getSeedSessions();
        setSessions(seeds);
        localStorage.setItem("VOICEPULSE_SESSIONS_STORE_v2", JSON.stringify(seeds));
      }
    } else {
      const seeds = getSeedSessions();
      setSessions(seeds);
      localStorage.setItem("VOICEPULSE_SESSIONS_STORE_v2", JSON.stringify(seeds));
    }

    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Handle Session completion, engaging CascadeFlow Sequential Pipeline
  const handleSessionComplete = async (history: DialogueTurn[]) => {
    setPipelineLogs([]);
    setMode("pipeline");
    setPipelineStage("clean");

    try {
      const result = await runCascadeFlowPipeline(history, (stage, progress, log) => {
        setPipelineStage(stage as any);
        setPipelineLogs(prev => [...prev, { stage, progress, log }]);
      });

      // Append live recorded session to database state
      const newSession = {
        id: `session_${Date.now()}`,
        name: `Respondent #${sessions.length + 1} (Speech Session)`,
        context: "Hackathon post-event voice feedback",
        timestamp: "Just now",
        result
      };

      const updatedSessions = [newSession, ...sessions];
      setSessions(updatedSessions);
      localStorage.setItem("VOICEPULSE_SESSIONS_STORE_v2", JSON.stringify(updatedSessions));

      // Fire-and-forget: record to Google Sheets (non-blocking)
      recordSessionToSheet(
        newSession.id,
        newSession.name,
        newSession.context,
        history,
        result
      ).then(res => {
        if (!res.success) console.warn("[Sheets] Could not record session:", res.error);
        else console.log("[Sheets] Session recorded successfully.");
      });

      // Complete Stage
      setPipelineStage("done");
    } catch (e) {
      console.error("Pipeline failure:", e);
      alert("Cognitive CascadeFlow encountered a deployment script warning, resetting to landing.");
      setMode("landing");
    }
  };

  // Delete a session
  const handleDeleteSession = (id: string) => {
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    localStorage.setItem("VOICEPULSE_SESSIONS_STORE_v2", JSON.stringify(updated));
  };

  // Force seed database refresh
  const handleResetSeeds = () => {
    const seeds = getSeedSessions();
    setSessions(seeds);
    localStorage.setItem("VOICEPULSE_SESSIONS_STORE_v2", JSON.stringify(seeds));
  };

  return (
    <div className="bg-brand-dark text-white selection:bg-brand-acid selection:text-brand-dark min-h-screen">
      
      {/* Custom premium cursor widgets */}
      <div ref={cursorRef} className="custom-cursor hidden lg:block" />
      <div ref={cursorRingRef} className="custom-cursor-ring hidden lg:block" />
      
      <AnimatePresence>
        {loading && <LoadingScreen onComplete={() => setLoading(false)} />}
      </AnimatePresence>

      {!loading && (
        <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           transition={{ duration: 0.5 }}
        >
          {/* Navigation Bar */}
          <nav className="fixed top-0 left-0 w-full z-40 p-8 flex justify-between items-center mix-blend-difference">
            <button 
              onClick={() => setMode("landing")} 
              className="text-3xl font-display text-white tracking-widest cursor-pointer hover:text-brand-acid transition-colors border-none bg-transparent"
            >
              VOICEPULSE
            </button>
            
            <div className="flex items-center gap-6">
              {mode !== "dashboard" ? (
                <button 
                  onClick={() => setMode("dashboard")}
                  className="font-mono text-brand-acid text-sm border border-brand-acid px-3 py-1 flex items-center gap-2 hover:bg-brand-acid hover:text-brand-dark transition-all cursor-pointer bg-brand-dark/10"
                >
                  <div className="w-2 h-2 bg-brand-acid rounded-full animate-pulse" />
                  OPERATOR CONSOLE
                </button>
              ) : (
                <button 
                  onClick={() => setMode("landing")}
                  className="font-mono text-white/70 hover:text-brand-acid text-xs transition-colors cursor-pointer border-none bg-transparent"
                >
                  VIEW_LANDING_PAGE
                </button>
              )}
            </div>
          </nav>

          {/* Core View Swapper */}
          <main>
            <AnimatePresence mode="wait">
              
              {mode === "landing" && (
                <motion.div
                  key="landing_view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <HeroSection onStart={() => setMode("interview")} />
                  <HorizontalScrollSection />
                  <PipelineSection />
                  <FeatureSection onStart={() => setMode("interview")} />
                  <UseCases />
                  <StatsCarousel />
                  <CTASection onStart={() => setMode("interview")} />
                  <Footer onGoConsole={() => setMode("dashboard")} />
                </motion.div>
              )}

              {mode !== "landing" && (
                <AuthGate>
                  <AnimatePresence mode="wait">
                    {mode === "interview" && (
                      <motion.div
                        key="interview_view"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      >
                        <VoiceWidget 
                          campaignQuestions={campaignQuestions}
                          onSessionComplete={handleSessionComplete}
                          onCancel={() => setMode("landing")}
                        />
                      </motion.div>
                    )}

                    {mode === "pipeline" && (
                      <motion.div
                        key="pipeline_view"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <CascadeFlowConsole 
                          logs={pipelineLogs}
                          currentStage={pipelineStage}
                          onAnimationFinished={() => setMode("dashboard")}
                        />
                      </motion.div>
                    )}

                    {mode === "dashboard" && (
                      <motion.div
                        key="dashboard_view"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      >
                        <OperatorDashboard 
                          sessions={sessions}
                          campaignQuestions={campaignQuestions}
                          setCampaignQuestions={setCampaignQuestions}
                          onDeleteSession={handleDeleteSession}
                          onResetSeeds={handleResetSeeds}
                          onBackToLanding={() => setMode("landing")}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </AuthGate>
              )}

            </AnimatePresence>
          </main>
        </motion.div>
      )}
    </div>
  );
}
