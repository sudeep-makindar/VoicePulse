import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
import { 
  Database, 
  RefreshCw, 
  Sparkles, 
  Search 
} from "lucide-react";
import { getApiKey } from "../services/gemini";
import { getSheetsUrl, SheetRow } from "../services/sheets";
import { fetchSheetData, analyzeFeedbackBatch } from "./AnalyzerLogic";

export default function SheetAnalyzerUI() {
  const [sheetData, setSheetData] = useState<SheetRow[]>([]);
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);
  const [batchAnalysis, setBatchAnalysis] = useState<string>("");
  const [isAnalyzingBatch, setIsAnalyzingBatch] = useState(false);
  const [sheetSearch, setSheetSearch] = useState("");

  const handleFetchSheet = async () => {
    setIsFetchingSheet(true);
    const data = await fetchSheetData();
    setSheetData(data);
    setIsFetchingSheet(false);
  };

  const handleAnalyzeBatch = async () => {
    if (!sheetData.length) return;
    setIsAnalyzingBatch(true);
    try {
      const result = await analyzeFeedbackBatch(sheetData);
      setBatchAnalysis(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzingBatch(false);
    }
  };

  const filteredSheetData = useMemo(() => {
    if (!sheetSearch) return sheetData;
    return sheetData.filter(row => 
      row.respondentName.toLowerCase().includes(sheetSearch.toLowerCase()) ||
      row.summary.toLowerCase().includes(sheetSearch.toLowerCase()) ||
      row.themes.toLowerCase().includes(sheetSearch.toLowerCase())
    );
  }, [sheetData, sheetSearch]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-8"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h3 className="text-2xl font-display text-white flex items-center gap-3">
            <Database className="text-emerald-400" />
            GOOGLE_SHEET_INTELLIGENCE
          </h3>
          <p className="text-sm text-brand-muted font-body mt-1">
            Analyze feedback aggregated across all users from your connected spreadsheet.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleFetchSheet}
            disabled={isFetchingSheet || !getSheetsUrl()}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-mono text-xs rounded-xl transition-all disabled:opacity-40 cursor-pointer"
          >
            <RefreshCw size={14} className={isFetchingSheet ? "animate-spin" : ""} />
            {isFetchingSheet ? "FETCHING..." : "FETCH_LATEST_DATA"}
          </button>

          <button
            onClick={handleAnalyzeBatch}
            disabled={isAnalyzingBatch || sheetData.length === 0 || !getApiKey()}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-acid text-brand-dark font-bold font-mono text-xs rounded-xl hover:shadow-[0_0_20px_rgba(200,255,0,0.3)] transition-all disabled:opacity-40 cursor-pointer"
          >
            <Sparkles size={14} />
            {isAnalyzingBatch ? "ANALYZING..." : "GENERATE_BATCH_INSIGHTS"}
          </button>
        </div>
      </div>

      {batchAnalysis && (
        <div className="glass border border-brand-acid/30 rounded-2xl p-8 bg-brand-acid/[0.03]">
          <div className="flex items-center gap-3 mb-6 border-b border-brand-acid/10 pb-4">
            <Sparkles className="text-brand-acid" size={20} />
            <h4 className="text-lg font-display text-white tracking-widest uppercase">AI_EXECUTIVE_SUMMARY</h4>
          </div>
          <div className="prose prose-invert max-w-none text-brand-muted font-body leading-relaxed whitespace-pre-wrap">
            {batchAnalysis}
          </div>
        </div>
      )}

      <div className="glass border border-white/5 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-white/5 bg-white/[0.02] flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted" size={16} />
            <input
              type="text"
              value={sheetSearch}
              onChange={(e) => setSheetSearch(e.target.value)}
              placeholder="Search respondents, summaries, themes..."
              className="w-full bg-brand-dark border border-white/10 focus:border-brand-acid/40 rounded-xl pl-12 pr-4 py-2.5 text-white outline-none font-body text-sm transition-all"
            />
          </div>
          <div className="font-mono text-[10px] text-brand-muted">
            SHOWING <span className="text-brand-acid">{filteredSheetData.length}</span> OF <span className="text-white">{sheetData.length}</span> RECORDS
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/5">
                <th className="px-6 py-4 font-mono text-[10px] text-brand-muted uppercase tracking-widest">Timestamp</th>
                <th className="px-6 py-4 font-mono text-[10px] text-brand-muted uppercase tracking-widest">Respondent</th>
                <th className="px-6 py-4 font-mono text-[10px] text-brand-muted uppercase tracking-widest">Summary</th>
                <th className="px-6 py-4 font-mono text-[10px] text-brand-muted uppercase tracking-widest">Sentiment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredSheetData.map((row, i) => (
                <tr key={i} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="px-6 py-4 font-mono text-[10px] text-brand-muted">
                    {new Date(row.timestamp).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-white text-sm">{row.respondentName}</div>
                    <div className="text-[10px] text-brand-muted font-mono">{row.sessionId.slice(0, 8)}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-brand-muted leading-relaxed max-w-md">
                    {row.summary}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 w-16 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            row.avgSentiment > 75 ? "bg-emerald-400" : row.avgSentiment > 50 ? "bg-yellow-400" : "bg-red-400"
                          }`}
                          style={{ width: `${row.avgSentiment}%` }}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-white">{row.avgSentiment}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSheetData.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-brand-muted font-mono text-xs">
                    {sheetData.length === 0 ? "NO_DATA_FETCHED_YET" : "NO_MATCHING_RECORDS_FOUND"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
