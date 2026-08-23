import React from 'react';
import { UserSettings } from '../types.js';
import { Sliders, HelpCircle, Sun, Moon, Sparkles, BookOpen, Brain, ShieldAlert } from 'lucide-react';

interface SettingsTabProps {
  settings: UserSettings;
  onSettingsChange: (settings: UserSettings) => void;
}

export default function SettingsTab({ settings, onSettingsChange }: SettingsTabProps) {
  
  const handleThemeToggle = () => {
    const nextTheme = settings.theme === 'light' ? 'dark' : 'light';
    onSettingsChange({ ...settings, theme: nextTheme });
    
    // Set class in document element
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleSliderChange = (key: keyof UserSettings, val: number) => {
    onSettingsChange({ ...settings, [key]: val });
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSettingsChange({ ...settings, modelName: e.target.value });
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      
      {/* Tab Header */}
      <div>
        <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white">RAG Engine Configuration</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Tune the similarity retrieval pipeline and model thresholds to configure answer constraints.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Setting Pane: The Controls */}
        <div className="md:col-span-2 space-y-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          
          {/* Theme Setup */}
          <div className="flex items-center justify-between pb-5 border-b border-slate-200 dark:border-slate-800">
            <div>
              <span className="block font-semibold text-slate-900 dark:text-white">Interface Theme</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Toggle dark and light contrast styling</span>
            </div>
            <button
              onClick={handleThemeToggle}
              className="h-10 px-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl flex items-center gap-2 font-medium text-sm transition-all border border-slate-200 dark:border-slate-700"
            >
              {settings.theme === 'light' ? (
                <>
                  <Moon className="h-4.5 w-4.5 text-indigo-600" />
                  <span>Dark Mode</span>
                </>
              ) : (
                <>
                  <Sun className="h-4.5 w-4.5 text-amber-500" />
                  <span>Light Mode</span>
                </>
              )}
            </button>
          </div>

          {/* Model Selector */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Brain className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400" />
                <span>LLM Generation Model</span>
              </label>
              <span className="text-xs text-slate-400 font-mono">Environment Config</span>
            </div>
            <select
              value={settings.modelName}
              onChange={handleModelChange}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
            >
              <option value="gemini-3.5-flash">Gemini 3.5 Flash (Recommended - Fastest)</option>
              <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Complex Reasoning)</option>
            </select>
          </div>

          {/* Similarity Threshold */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Sliders className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400" />
                <span>Similarity Threshold</span>
              </label>
              <span className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400">{settings.similarityThreshold}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.8"
              step="0.05"
              value={settings.similarityThreshold}
              onChange={(e) => handleSliderChange('similarityThreshold', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>0.1 (Lenient Retrieval)</span>
              <span>0.8 (Highly Strict)</span>
            </div>
          </div>

          {/* Top-K Retrieval */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Sparkles className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400" />
                <span>Top-K Citations</span>
              </label>
              <span className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400">{settings.topK} Chunks</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={settings.topK}
              onChange={(e) => handleSliderChange('topK', parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>1 chunk</span>
              <span>10 chunks max</span>
            </div>
          </div>

        </div>

        {/* Right Info Pane: The Architecture Specs */}
        <div className="space-y-6">
          
          {/* Static Chunk Details */}
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" />
              <span>Indexing Rules</span>
            </h3>
            <div className="space-y-4">
              <div>
                <span className="block text-xs text-slate-400">Chunking Strategy</span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Recursive Token Splitter</span>
              </div>
              <div>
                <span className="block text-xs text-slate-400">Target Chunk Size</span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">600 tokens (~2,400 chars)</span>
              </div>
              <div>
                <span className="block text-xs text-slate-400">Overlap Padding</span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">100 tokens (~400 chars)</span>
              </div>
              <div>
                <span className="block text-xs text-slate-400">Vector Space Model</span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Gemini-2 768-D Space</span>
              </div>
            </div>
          </div>

          {/* Fallback Response Warning Card */}
          <div className="bg-amber-50/20 dark:bg-amber-950/15 border border-amber-200/40 dark:border-amber-900/40 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wide">RAG Safety Mandate</h4>
                <p className="text-xs text-amber-800 dark:text-amber-400 mt-1 leading-relaxed">
                  To prevent hallucinations, DocMind AI returns a strict fallback if document similarity sits below your chosen threshold:
                </p>
                <div className="mt-2.5 p-2 bg-white dark:bg-slate-900 border border-amber-100 dark:border-slate-800 rounded-lg text-[11px] font-mono font-medium text-amber-700 dark:text-amber-300">
                  "I couldn't find this information in the uploaded document."
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
