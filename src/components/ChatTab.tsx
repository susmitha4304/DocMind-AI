import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { API } from '../api.js';
import { Message, Chunk, UserSettings, Document } from '../types.js';
import { 
  Send, 
  Sparkles, 
  BookOpen, 
  ThumbsUp, 
  ThumbsDown, 
  Check, 
  HelpCircle, 
  FileText, 
  ChevronRight, 
  CornerDownRight, 
  Trash2, 
  RotateCcw, 
  Copy, 
  Filter, 
  Maximize2,
  ExternalLink,
  Bot
} from 'lucide-react';

interface ChatTabProps {
  activeChatId: string | null;
  settings: UserSettings;
  chats: any[];
  documents: Document[];
  onSendMessage: (text: string, docId?: string) => Promise<void>;
  onSelectChat: (id: string) => void;
  onCreateNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onClearChatMessages: (id: string) => void;
  loadingMessage: boolean;
}

export default function ChatTab({
  activeChatId,
  settings,
  chats,
  documents,
  onSendMessage,
  onSelectChat,
  onCreateNewChat,
  onDeleteChat,
  onClearChatMessages,
  loadingMessage,
}: ChatTabProps) {
  const [inputText, setInputText] = useState('');
  const [selectedDocFilter, setSelectedDocFilter] = useState<string>('all');
  const [selectedCitation, setSelectedCitation] = useState<Chunk | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<{ [msgId: string]: 'up' | 'down' }>({});
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeChat = chats.find((c) => c.id === activeChatId);
  const hasDocuments = documents.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages, loadingMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || loadingMessage) return;

    const msg = inputText;
    setInputText('');
    await onSendMessage(msg, selectedDocFilter);
  };

  const handleCopyMessage = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleFeedback = async (messageId: string, isPositive: boolean) => {
    try {
      await API.submitFeedback(messageId, isPositive);
      setFeedbackSubmitted((prev) => ({
        ...prev,
        [messageId]: isPositive ? 'up' : 'down',
      }));
    } catch (e) {
      console.error('Failed to save feedback:', e);
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.7) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50';
    if (score >= 0.4) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50';
    return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/50';
  };

  const handleSampleQuestion = (q: string) => {
    setInputText(q);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)] min-h-[550px]">
      
      {/* Messages Thread (Col span 2) */}
      <div className="lg:col-span-2 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden h-full">
        
        {/* Active Chat Header with Controls */}
        <div className="h-16 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center space-x-2.5 min-w-0">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline">Session:</span>
            <span className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[140px] sm:max-w-[220px]">
              {activeChat ? activeChat.title : (hasDocuments ? 'Document Q&A' : 'No Active Session')}
            </span>
            {hasDocuments && (
              <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase rounded-full border border-emerald-100 dark:border-emerald-900/50 shrink-0">
                {documents.length} Indexed Doc{documents.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {/* Right Header Toolbar: Doc Filter & Delete Conversation Buttons */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Document Scoping Filter */}
            {hasDocuments && (
              <div className="hidden md:flex items-center space-x-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1">
                <Filter className="h-3 w-3 text-slate-400" />
                <select
                  value={selectedDocFilter}
                  onChange={(e) => setSelectedDocFilter(e.target.value)}
                  className="bg-transparent text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none max-w-[130px] truncate"
                >
                  <option value="all">All Documents</option>
                  {documents.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Clear Messages Button */}
            {activeChat && activeChat.messages.length > 0 && (
              <button
                onClick={() => onClearChatMessages(activeChat.id)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-xs flex items-center gap-1"
                title="Clear message history in this chat"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}

            {/* Delete Conversation Button with inline confirm */}
            {activeChat && (
              confirmDeleteId === activeChat.id ? (
                <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 rounded-lg p-1">
                  <span className="text-[11px] text-rose-600 dark:text-rose-400 font-bold px-1">Delete chat?</span>
                  <button
                    onClick={() => {
                      onDeleteChat(activeChat.id);
                      setConfirmDeleteId(null);
                    }}
                    className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[10px] font-medium"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteId(activeChat.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors text-xs flex items-center gap-1"
                  title="Delete this conversation"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Message Panel content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {!activeChatId ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto p-4">
              <div className="h-14 w-14 bg-indigo-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 shadow-sm">
                <Sparkles className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
                {hasDocuments ? 'Ready to Answer Document Queries' : 'No Documents Uploaded Yet'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                {hasDocuments
                  ? "Select an existing session or start a new conversation below to ask questions grounded strictly in your indexed documents."
                  : "Upload any PDF, DOCX, TXT, CSV, JSON, Markdown, or Code file to enable instant semantic search & high-precision Q&A."}
              </p>

              {hasDocuments && (
                <button
                  onClick={onCreateNewChat}
                  className="mt-6 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm flex items-center gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Start New Conversation</span>
                </button>
              )}
            </div>
          ) : activeChat.messages.length === 0 ? (
            /* New Chat prompt chips */
            <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto py-8">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl text-indigo-600 dark:text-indigo-400 mb-3">
                <Sparkles className="h-7 w-7" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Ask anything about your documents</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Ask questions, explore topics, or get summaries with direct references to your files.
              </p>

              {/* Sample Prompt Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-6 w-full text-left">
                <button
                  onClick={() => handleSampleQuestion('Provide a comprehensive summary and key takeaways from the document.')}
                  className="p-3 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl transition-all text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  <div className="font-bold text-indigo-600 dark:text-indigo-400 mb-0.5 flex items-center justify-between">
                    <span>Document Summary</span>
                    <ChevronRight className="h-3 w-3" />
                  </div>
                  <span className="text-[11px] text-slate-500">"Summarize main points & takeaways..."</span>
                </button>

                <button
                  onClick={() => handleSampleQuestion('What are the critical numbers, metrics, or timeline dates specified?')}
                  className="p-3 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl transition-all text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  <div className="font-bold text-indigo-600 dark:text-indigo-400 mb-0.5 flex items-center justify-between">
                    <span>Key Data & Details</span>
                    <ChevronRight className="h-3 w-3" />
                  </div>
                  <span className="text-[11px] text-slate-500">"Extract critical metrics, dates, or terms..."</span>
                </button>
              </div>
            </div>
          ) : (
            /* Chat message scroll list */
            activeChat.messages.map((message: Message) => {
              const isUser = message.role === 'user';
              return (
                <div
                  key={message.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start items-start space-x-3'}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex-shrink-0 flex items-center justify-center text-xs shadow-xs mt-1">
                      <Sparkles className="h-4 w-4" />
                    </div>
                  )}
                  <div
                    className={`${
                      isUser
                        ? 'max-w-[85%] sm:max-w-xl bg-indigo-600 border border-indigo-700 text-white rounded-2xl rounded-tr-none shadow-xs text-sm p-4'
                        : 'max-w-[85%] sm:max-w-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 rounded-2xl rounded-tl-none shadow-xs'
                    }`}
                  >
                    {/* Header Tag */}
                    <div className="flex items-center gap-2 mb-2.5 justify-between">
                      <span className={`text-[11px] font-bold ${isUser ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'}`}>
                        {isUser ? 'You' : 'DocMind'}
                      </span>
                    </div>

                    {/* Content Text */}
                    {isUser ? (
                      <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-white">
                        {message.content}
                      </div>
                    ) : (
                      <div className="text-sm leading-relaxed font-sans text-slate-800 dark:text-slate-200 markdown-content space-y-3">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({ children }) => <h1 className="text-base font-bold text-slate-900 dark:text-white mt-3 mb-1.5">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-sm font-bold text-slate-900 dark:text-white mt-3 mb-1">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-sm font-semibold text-slate-900 dark:text-white mt-2 mb-1">{children}</h3>,
                            p: ({ children }) => <p className="mb-2.5 last:mb-0 leading-relaxed">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
                            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                            strong: ({ children }) => <strong className="font-semibold text-slate-900 dark:text-slate-100">{children}</strong>,
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-2 border-indigo-500 pl-3.5 italic my-2.5 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 py-1 rounded-r-md">
                                {children}
                              </blockquote>
                            ),
                            code: ({ children }) => (
                              <code className="bg-slate-100 dark:bg-slate-850 px-1.5 py-0.5 rounded text-xs font-mono text-indigo-600 dark:text-indigo-400">
                                {children}
                              </code>
                            ),
                            table: ({ children }) => (
                              <div className="overflow-x-auto my-3 rounded-lg border border-slate-200 dark:border-slate-800">
                                <table className="min-w-full text-xs text-left divide-y divide-slate-200 dark:divide-slate-800">
                                  {children}
                                </table>
                              </div>
                            ),
                            th: ({ children }) => (
                              <th className="px-3 py-2 bg-slate-50 dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-300">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="px-3 py-2 border-t border-slate-100 dark:border-slate-850 text-slate-600 dark:text-slate-400">
                                {children}
                              </td>
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    )}

                    {/* Source Citations Tags - Clean & Minimal */}
                    {!isUser && message.citations && message.citations.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-850 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1 mr-1">
                          <BookOpen className="h-3 w-3 text-indigo-500" />
                          <span>Sources:</span>
                        </span>
                        {message.citations.slice(0, 3).map((citation, idx) => (
                          <button
                            key={citation.id || idx}
                            onClick={() => setSelectedCitation(citation)}
                            className={`text-[11px] px-2 py-0.5 rounded-md font-medium border flex items-center gap-1 transition-all ${
                              selectedCitation?.id === citation.id
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-800'
                                : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                            }`}
                          >
                            <span className="truncate max-w-[120px]">{citation.docName}</span>
                            <span className="text-[10px] text-slate-400">p.{citation.pageNumber}</span>
                          </button>
                        ))}
                        {message.citations.length > 3 && (
                          <span className="text-[10px] text-slate-400">+{message.citations.length - 3} more</span>
                        )}
                      </div>
                    )}

                    {/* Message Actions Bar (Copy + Feedback) */}
                    {!isUser && (
                      <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-850 flex items-center justify-between text-slate-400 text-xs">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCopyMessage(message.content, message.id)}
                            className="p-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex items-center gap-1 text-[11px]"
                            title="Copy answer"
                          >
                            {copiedMsgId === message.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                            <span>{copiedMsgId === message.id ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {feedbackSubmitted[message.id] === 'up' ? (
                            <span className="text-[11px] text-emerald-500 font-bold flex items-center gap-1">
                              <Check className="h-3 w-3" />
                              <span>Helpful</span>
                            </span>
                          ) : feedbackSubmitted[message.id] === 'down' ? (
                            <span className="text-[11px] text-rose-500 font-bold flex items-center gap-1">
                              <Check className="h-3 w-3" />
                              <span>Reported</span>
                            </span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleFeedback(message.id, true)}
                                className="p-1 hover:text-indigo-600 transition-colors"
                                title="Helpful response"
                              >
                                <ThumbsUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleFeedback(message.id, false)}
                                className="p-1 hover:text-rose-500 transition-colors"
                                title="Not helpful"
                              >
                                <ThumbsDown className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {isUser && (
                      <div className="mt-1.5 text-right text-[10px] text-indigo-200">
                        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Typing Loader bubble */}
          {loadingMessage && (
            <div className="flex justify-start items-start space-x-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex-shrink-0 flex items-center justify-center text-xs shadow-xs mt-1 animate-pulse">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-none p-4 max-w-sm space-y-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                  Finding answers in your documents...
                </span>
                <div className="flex gap-1.5 py-1">
                  <div className="h-2 w-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="h-2 w-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="h-2 w-2 bg-indigo-600 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* INPUT AREA */}
        <footer className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="relative flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-inner focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all">
              <div className="pl-3 text-slate-400">
                <Sparkles className="h-4.5 w-4.5" />
              </div>
              <input 
                type="text" 
                disabled={!hasDocuments || loadingMessage}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  !hasDocuments
                    ? 'Please upload a document in the Upload tab first...'
                    : 'Ask any question regarding the uploaded documents...'
                }
                className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-sm px-3 text-slate-800 dark:text-slate-200 placeholder-slate-400 py-2.5"
              />
              <button 
                type="submit"
                disabled={!inputText.trim() || !hasDocuments || loadingMessage}
                className="bg-indigo-600 text-white py-2 px-4 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5"
              >
                <span>Ask</span>
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </footer>

      </div>

      {/* Right Column: Citation Reference Viewer */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 h-full flex flex-col overflow-hidden">
        <h3 className="font-bold text-slate-950 dark:text-white font-display mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-sm">Source Reference</span>
          </div>
          {selectedCitation && (
            <button
              onClick={() => setSelectedCitation(null)}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Close
            </button>
          )}
        </h3>

        <div className="flex-1 overflow-y-auto mt-2 border-t border-slate-200 dark:border-slate-800 pt-3">
          {selectedCitation ? (
            <div className="space-y-4">
              {/* Citation Metadata Header */}
              <div className="p-3.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Document</span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 block truncate mt-0.5">{selectedCitation.docName}</span>
                
                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-900 text-xs">
                  <span className="text-slate-500">Location: <span className="font-semibold text-slate-800 dark:text-slate-200">Page {selectedCitation.pageNumber}</span></span>
                </div>
              </div>

              {/* Exact Quote block */}
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Relevant Passage</span>
                <div className="p-4 bg-white dark:bg-slate-950 border-l-4 border-indigo-500 rounded-r-xl border-y border-r border-slate-200 dark:border-slate-800 text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans max-h-60 overflow-y-auto">
                  "{selectedCitation.text}"
                </div>
              </div>

              {/* Copy Quote Button */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedCitation.text);
                }}
                className="w-full py-2 bg-white dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Passage</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-xs mx-auto text-slate-400 p-4">
              <HelpCircle className="h-8 w-8 text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-xs">Click any source tag under an answer to view the exact page and passage in the document.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
