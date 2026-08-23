import React, { useState, useRef } from 'react';
import { API } from '../api.js';
import { UserSettings } from '../types.js';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  FileCode, 
  FileSpreadsheet, 
  FileType, 
  FolderArchive,
  ArrowRight,
  Layers
} from 'lucide-react';

interface UploadTabProps {
  settings: UserSettings;
  onUploadSuccess: () => void;
  onOpenChat: () => void;
  onOpenSearch: () => void;
}

interface StagedFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
  chunksCount?: number;
  pagesCount?: number;
}

export default function UploadTab({ settings, onUploadSuccess, onOpenChat, onOpenSearch }: UploadTabProps) {
  const [dragActive, setDragActive] = useState(false);
  const [queue, setQueue] = useState<StagedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFileList = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const staged: StagedFile[] = fileArray.map(f => ({
      id: Math.random().toString(36).substring(2, 9),
      file: f,
      status: 'pending',
    }));

    setQueue(prev => [...prev, ...staged]);
    setIsProcessing(true);

    for (const item of staged) {
      // Update item status to uploading
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading' } : q));

      try {
        const file = item.file;
        const reader = new FileReader();

        const fileData = await new Promise<{ base64: string; size: number }>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1] || '';
            resolve({ base64, size: file.size });
          };
          reader.onerror = () => reject(new Error('Failed to read file binary'));
          reader.readAsDataURL(file);
        });

        const res = await API.uploadDocument(
          file.name,
          file.type || 'text/plain',
          fileData.size,
          fileData.base64,
          settings.chunkSize,
          settings.chunkOverlap
        );

        setQueue(prev => prev.map(q => q.id === item.id ? {
          ...q,
          status: 'done',
          chunksCount: res.chunksCount,
          pagesCount: res.document.pageCount,
        } : q));

        onUploadSuccess();
      } catch (err: any) {
        console.error('Error uploading file:', err);
        setQueue(prev => prev.map(q => q.id === item.id ? {
          ...q,
          status: 'error',
          error: err.message || 'Processing failed',
        } : q));
      }
    }

    setIsProcessing(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFileList(e.dataTransfer.files);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFileList(e.target.files);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['csv', 'tsv', 'xlsx', 'xls'].includes(ext)) {
      return <FileSpreadsheet className="h-5 w-5 text-emerald-500" />;
    }
    if (['json', 'js', 'ts', 'py', 'java', 'cpp', 'html', 'xml', 'sql', 'sh'].includes(ext)) {
      return <FileCode className="h-5 w-5 text-amber-500" />;
    }
    if (['pdf'].includes(ext)) {
      return <FileText className="h-5 w-5 text-rose-500" />;
    }
    if (['docx', 'doc', 'rtf', 'txt', 'md'].includes(ext)) {
      return <FileType className="h-5 w-5 text-indigo-500" />;
    }
    return <FileText className="h-5 w-5 text-slate-500" />;
  };

  const completedCount = queue.filter(q => q.status === 'done').length;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      
      {/* Tab Header */}
      <div>
        <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
          <UploadCloud className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <span>Upload Any Document</span>
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Supports any document format: <strong>PDF, Word (DOCX/DOC), Plain Text (TXT/MD), Tabular Data (CSV/TSV), JSON/XML, Logs, Source Code (JS/TS/Python/Java/SQL/etc.), and more</strong>.
        </p>
      </div>

      {/* Drag & Drop Canvas */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-3xl p-10 sm:p-14 text-center cursor-pointer transition-all duration-300 ${
          dragActive
            ? 'border-indigo-600 bg-indigo-50/40 dark:border-indigo-400 dark:bg-indigo-950/20 scale-[1.01]'
            : 'border-slate-300 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-white dark:bg-slate-900 shadow-sm'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          className="hidden"
        />
        <div className="flex flex-col items-center">
          <div className="h-16 w-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform">
            <UploadCloud className="h-8 w-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
            Drag & drop your files here, or <span className="text-indigo-600 dark:text-indigo-400 underline">browse files</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-md">
            Upload single or multiple files at once. Every file is automatically parsed, token-chunked, embedded into 768-dim vectors, and indexed into your RAG store.
          </p>

          {/* Format Badges */}
          <div className="flex flex-wrap justify-center gap-1.5 mt-6 max-w-lg">
            {['PDF', 'DOCX', 'TXT', 'MARKDOWN', 'CSV / TSV', 'JSON', 'XML / HTML', 'CODE (PY/JS/SQL/C++)', 'LOGS'].map(fmt => (
              <span key={fmt} className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                {fmt}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Upload Queue & Processing List */}
      {queue.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900 dark:text-white">Uploaded Queue</span>
              <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-bold font-mono">
                {completedCount}/{queue.length} ready
              </span>
            </div>

            {completedCount > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenSearch}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                >
                  <span>Search Content</span>
                </button>
                <button
                  onClick={onOpenChat}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 shadow-sm"
                >
                  <span>Start Chatting</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2.5 max-h-[280px] overflow-y-auto">
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shrink-0">
                    {getFileIcon(item.file.name)}
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block truncate max-w-xs sm:max-w-md">
                      {item.file.name}
                    </span>
                    <span className="text-slate-500 text-[10px]">
                      {formatFileSize(item.file.size)}
                      {item.pagesCount !== undefined && ` • ${item.pagesCount} pages`}
                      {item.chunksCount !== undefined && ` • ${item.chunksCount} chunks indexed`}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {item.status === 'pending' && (
                    <span className="text-slate-400 font-medium">Pending...</span>
                  )}
                  {item.status === 'uploading' && (
                    <div className="flex items-center gap-1.5 text-indigo-600 font-semibold">
                      <div className="h-3.5 w-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      <span>Indexing...</span>
                    </div>
                  )}
                  {item.status === 'done' && (
                    <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Vectorized</span>
                    </div>
                  )}
                  {item.status === 'error' && (
                    <div className="flex items-center gap-1 text-rose-500 font-bold" title={item.error}>
                      <AlertTriangle className="h-4 w-4" />
                      <span>Failed</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RAG Pipeline Breakdown Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2 shadow-sm">
          <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
            1
          </div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white">Smart Parser</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Extracts raw text, table structures, CSV rows, and code blocks with page layout preservation.
          </p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2 shadow-sm">
          <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
            2
          </div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white">Semantic Chunking</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Splits text into token-bounded windows with sentence-boundary preservation and overlap.
          </p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2 shadow-sm">
          <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
            3
          </div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white">768-Dim Embeddings</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Stores dense vector embeddings and keyword indexes for instant cosine similarity retrieval.
          </p>
        </div>
      </div>

    </div>
  );
}
