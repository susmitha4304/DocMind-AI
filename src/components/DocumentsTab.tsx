import React, { useState } from 'react';
import { API } from '../api.js';
import { Document, Chunk } from '../types.js';
import { 
  FileText, 
  Trash2, 
  Search, 
  BookOpen, 
  X, 
  Sparkles,
  Layers,
  AlertTriangle,
  CheckCircle2,
  HardDrive
} from 'lucide-react';

interface DocumentsTabProps {
  documents: Document[];
  onDeleteDocument: (id: string) => Promise<void> | void;
  onClearAllDocuments?: () => Promise<void> | void;
  onOpenSearchForDoc: (docId: string) => void;
  onOpenChatWithPrompt: (prompt: string) => void;
}

export default function DocumentsTab({
  documents,
  onDeleteDocument,
  onClearAllDocuments,
  onOpenSearchForDoc,
  onOpenChatWithPrompt,
}: DocumentsTabProps) {
  const [filterText, setFilterText] = useState('');
  const [inspectDoc, setInspectDoc] = useState<Document | null>(null);
  const [docChunks, setDocChunks] = useState<Chunk[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);

  // Deletion modals state
  const [docToDelete, setDocToDelete] = useState<Document | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const filteredDocs = documents.filter(d => 
    d.name.toLowerCase().includes(filterText.toLowerCase()) ||
    d.type.toLowerCase().includes(filterText.toLowerCase())
  );

  const handleInspect = async (doc: Document) => {
    setInspectDoc(doc);
    setLoadingChunks(true);
    try {
      const res = await API.getDocumentChunks(doc.id);
      setDocChunks(res.chunks || []);
    } catch (e) {
      console.error('Failed to load document chunks:', e);
      setDocChunks([]);
    } finally {
      setLoadingChunks(false);
    }
  };

  const confirmDeleteSingle = async () => {
    if (!docToDelete) return;
    setIsDeleting(true);
    try {
      const docName = docToDelete.name;
      await onDeleteDocument(docToDelete.id);
      if (inspectDoc?.id === docToDelete.id) {
        setInspectDoc(null);
      }
      setDocToDelete(null);
      setStatusMessage(`"${docName}" was successfully removed.`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (e) {
      console.error('Failed to delete document:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmClearAll = async () => {
    if (!onClearAllDocuments) return;
    setIsDeleting(true);
    try {
      await onClearAllDocuments();
      setInspectDoc(null);
      setShowClearAllModal(false);
      setStatusMessage('All documents and vector indexes have been cleared.');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (e) {
      console.error('Failed to clear all documents:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Status banner */}
      {statusMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <span>Document Index Library</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your indexed documents, review stored chunk partitions, or delete vector indexes.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {documents.length > 0 && (
            <>
              <div className="relative w-full sm:w-56">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Filter library..."
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {onClearAllDocuments && (
                <button
                  onClick={() => setShowClearAllModal(true)}
                  className="px-3 py-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-rose-200 dark:border-rose-900/50 shrink-0"
                  title="Delete all documents"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Clear All</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <th className="p-4 pl-6">Document Name</th>
                <th className="p-4">Format</th>
                <th className="p-4">Pages / Size</th>
                <th className="p-4">Indexed Date</th>
                <th className="p-4 text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-400">
                    {documents.length === 0 
                      ? 'No documents indexed yet. Upload files to start querying with RAG.' 
                      : 'No documents match your filter search.'}
                  </td>
                </tr>
              ) : (
                filteredDocs.map(doc => (
                  <tr key={doc.id} className="hover:bg-slate-50/75 dark:hover:bg-slate-950/40 transition-colors">
                    <td className="p-4 pl-6 font-semibold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="block truncate max-w-xs sm:max-w-sm font-medium">{doc.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">ID: {doc.id.substring(0, 8)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-xs font-mono font-bold uppercase text-slate-600 dark:text-slate-400">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md">
                        {doc.type}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-slate-600 dark:text-slate-400">
                      <div>{doc.pageCount} page{doc.pageCount === 1 ? '' : 's'}</div>
                      <div className="text-[11px] text-slate-400">{formatFileSize(doc.size)}</div>
                    </td>
                    <td className="p-4 text-xs text-slate-400">
                      {new Date(doc.uploadDate).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right pr-6">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleInspect(doc)}
                          className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-1"
                          title="Inspect vector chunks"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Chunks</span>
                        </button>
                        <button
                          onClick={() => onOpenSearchForDoc(doc.id)}
                          className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-1"
                          title="Search inside this document"
                        >
                          <Search className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Search</span>
                        </button>
                        <button
                          onClick={() => setDocToDelete(doc)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50"
                          title="Delete this document and all vectors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Document Chunks Modal */}
      {inspectDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-600" />
                  <span>{inspectDoc.name}</span>
                </h3>
                <span className="text-xs text-slate-500">
                  {docChunks.length} Vector Chunk Segments • {inspectDoc.pageCount} Pages • {formatFileSize(inspectDoc.size)}
                </span>
              </div>
              <button
                onClick={() => setInspectDoc(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 p-1">
              {loadingChunks ? (
                <div className="p-12 text-center">
                  <div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Loading vector chunks...</p>
                </div>
              ) : docChunks.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No chunks stored for this document.
                </div>
              ) : (
                docChunks.map((c, i) => (
                  <div
                    key={c.id || i}
                    className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between text-slate-400 font-mono text-[10px]">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">Chunk #{i + 1}</span>
                      <span>Page {c.pageNumber}</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                      {c.text}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 gap-3">
              <button
                onClick={() => setDocToDelete(inspectDoc)}
                className="px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-rose-200 dark:border-rose-900/50"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Document</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const docName = inspectDoc.name;
                    setInspectDoc(null);
                    onOpenChatWithPrompt(`Summarize key insights and topics from ${docName}`);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Ask AI in Chat</span>
                </button>
                <button
                  onClick={() => setInspectDoc(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Document Confirmation Modal */}
      {docToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 rounded-xl">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Delete Document</h3>
                <p className="text-xs text-slate-500">This will remove the file and all vector embeddings.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs space-y-1">
              <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">{docToDelete.name}</span>
              <span className="text-slate-500 font-mono text-[11px] block">{docToDelete.pageCount} page(s) • {formatFileSize(docToDelete.size)}</span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteSingle}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm shadow-rose-600/20 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                <span>{isDeleting ? 'Deleting...' : 'Delete Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Documents Confirmation Modal */}
      {showClearAllModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 rounded-xl">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Clear Entire Library</h3>
                <p className="text-xs text-slate-500">Delete all {documents.length} uploaded documents and vector index stores.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Are you sure you want to remove all indexed files? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowClearAllModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmClearAll}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm shadow-rose-600/20 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                <span>{isDeleting ? 'Clearing...' : 'Clear All Documents'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
