import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { API } from '../api.js';
import { Document, ContentSearchResult, Chunk } from '../types.js';
import { Search, FileText, Sparkles, BookOpen, ChevronRight, Copy, Check, X, ArrowUpRight, MessageSquare, Compass } from 'lucide-react';

interface SearchTabProps {
  documents: Document[];
  onAskInChat: (question: string) => void;
}

export default function SearchTab({ documents, onAskInChat }: SearchTabProps) {
  const [query, setQuery] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string>('all');
  const [results, setResults] = useState<ContentSearchResult[]>([]);
  const [overview, setOverview] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedChunk, setSelectedChunk] = useState<Chunk | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setHasSearched(true);
    setOverview(null);

    try {
      const response = await API.searchDocumentContent(query.trim(), selectedDocId);
      setResults(response.results || []);
      setOverview(response.overview || null);
    } catch (e) {
      console.error('Search failed:', e);
      setResults([]);
      setOverview(null);
    } finally {
      setSearching(false);
    }
  };

  // Trigger search on document filter change if query already exists
  useEffect(() => {
    if (query.trim()) {
      handleSearch();
    }
  }, [selectedDocId]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Highlight matched keywords in snippet
  const renderHighlightedSnippet = (text: string, keywords: string[]) => {
    if (!keywords || keywords.length === 0) return text;
    
    const escaped = keywords.filter(k => k.trim().length > 1).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    if (!escaped) return text;

    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) => {
      const isMatch = keywords.some(k => k.toLowerCase() === part.toLowerCase());
      return isMatch ? (
        <mark key={i} className="bg-amber-100 dark:bg-amber-500/25 text-amber-950 dark:text-amber-200 px-1 py-0.5 rounded font-semibold">
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      );
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
            <Search className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <span>Search in Documents</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Search for specific words, facts, or questions across your uploaded documents to find exact passages instantly.
          </p>
        </div>
      </div>

      {/* Search Input Bar & Document Filter */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="h-4.5 w-4.5" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search anything in your documents (e.g., 'quarterly profit', 'refund policy', 'section 3')..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); setResults([]); setOverview(null); setHasSearched(false); }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Document Scope Filter */}
          <div className="flex gap-2 shrink-0">
            <div className="relative min-w-[160px]">
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Documents ({documents.length})</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name.length > 22 ? doc.name.substring(0, 22) + '...' : doc.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm flex items-center gap-2"
            >
              {searching ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span>Search</span>
            </button>
          </div>
        </form>

        {/* Quick Suggestion Chips */}
        {documents.length > 0 && !hasSearched && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
              Quick Searches:
            </span>
            {documents.slice(0, 3).map(doc => {
              const baseName = doc.name.replace(/\.[^/.]+$/, '');
              return (
                <button
                  key={doc.id}
                  onClick={() => { setQuery(baseName); }}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 rounded-lg text-xs transition-colors truncate max-w-xs"
                >
                  "{baseName}"
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Loading state */}
      {searching && (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <div className="h-8 w-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Searching your documents...</p>
        </div>
      )}

      {/* Empty State */}
      {!searching && hasSearched && results.length === 0 && (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
          <FileText className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto" />
          <h3 className="font-bold text-slate-800 dark:text-slate-200">No matching content found for "{query}"</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Try searching for different keywords, selecting "All Documents", or uploading more files.
          </p>
        </div>
      )}

      {/* Results Section */}
      {!searching && results.length > 0 && (
        <div className="space-y-6">

          {/* Google NotebookLM Style Direct Overview / Answer */}
          {overview && (
            <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl p-5 sm:p-6 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <span className="font-bold text-sm text-indigo-950 dark:text-indigo-200 font-display">
                    Document Overview
                  </span>
                </div>
                <button
                  onClick={() => onAskInChat(`Regarding ${query}: ${overview}`)}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <span>Ask follow-up in Chat</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="text-sm leading-relaxed text-slate-800 dark:text-slate-200 font-sans space-y-2">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc pl-5 my-1.5 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-5 my-1.5 space-y-1">{children}</ol>,
                    strong: ({ children }) => <strong className="font-semibold text-slate-900 dark:text-slate-100">{children}</strong>,
                    code: ({ children }) => <code className="bg-indigo-100/60 dark:bg-indigo-900/60 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                  }}
                >
                  {overview}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Document Passages List */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Found in Documents ({results.length})
              </span>
              <button
                onClick={() => onAskInChat(`What does the document say about: ${query}?`)}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>Ask full question in Chat</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {results.map((res, index) => (
                <div
                  key={res.chunk.id || index}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800/80 rounded-2xl p-5 shadow-xs transition-all space-y-3"
                >
                  {/* Passage Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-sm flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                        <span className="truncate">{res.chunk.docName}</span>
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md text-[11px] font-semibold shrink-0">
                        Page {res.chunk.pageNumber}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(res.chunk.text, res.chunk.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1 text-[11px]"
                        title="Copy text"
                      >
                        {copiedId === res.chunk.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-emerald-600 font-medium">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Excerpt Body */}
                  <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 font-sans whitespace-pre-wrap">
                    {renderHighlightedSnippet(res.snippet, res.matchedKeywords)}
                  </div>

                  {/* Actions Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-50 dark:border-slate-850 text-xs">
                    <button
                      onClick={() => setSelectedChunk(res.chunk)}
                      className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 font-medium flex items-center gap-1"
                    >
                      <BookOpen className="h-3.5 w-3.5 text-indigo-500" />
                      <span>View Full Section</span>
                    </button>

                    <button
                      onClick={() => onAskInChat(`From ${res.chunk.docName} (Page ${res.chunk.pageNumber}): What are the key details regarding "${res.snippet.substring(0, 100).replace(/\n/g, ' ')}..."?`)}
                      className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Ask in Chat</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Full Section Viewer Modal */}
      {selectedChunk && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 dark:text-white truncate">{selectedChunk.docName}</h3>
                <span className="text-xs text-slate-500">Page {selectedChunk.pageNumber} • Full Section Excerpt</span>
              </div>
              <button
                onClick={() => setSelectedChunk(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-950 rounded-xl text-sm leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap border border-slate-200 dark:border-slate-800 font-sans">
              {selectedChunk.text}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => handleCopy(selectedChunk.text, selectedChunk.id)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                {copiedId === selectedChunk.id ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                <span>Copy Full Text</span>
              </button>

              <button
                onClick={() => {
                  const q = `Explain the following from ${selectedChunk.docName} (Page ${selectedChunk.pageNumber}): "${selectedChunk.text.substring(0, 120)}..."`;
                  setSelectedChunk(null);
                  onAskInChat(q);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Discuss in Chat</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
