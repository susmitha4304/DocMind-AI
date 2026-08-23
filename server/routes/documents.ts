import { Router } from 'express';
import { Storage } from '../db/storage.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { DocumentProcessor } from '../services/documentProcessor.js';
import { VectorStore } from '../services/vectorStore.js';
import { RAGEngine } from '../services/ragEngine.js';

const router = Router();

// Get all documents
router.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const docs = Storage.getDocuments();
    res.json({ documents: docs });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching documents.' });
  }
});

// Search inside document content across all or specific indexed documents
router.get('/search', requireAuth, async (req: AuthenticatedRequest, res) => {
  const query = req.query.query as string;
  const documentId = req.query.documentId as string;

  if (!query || !query.trim()) {
    res.status(400).json({ error: 'Search query is required.' });
    return;
  }

  try {
    const results = await VectorStore.searchContent(query, documentId);
    
    // Generate NotebookLM / ChatGPT-style overview summary for the query
    const topChunks = results.slice(0, 4).map(r => r.chunk);
    const overview = results.length > 0 ? await RAGEngine.generateSearchOverview(query, topChunks) : null;

    res.json({
      query,
      documentId: documentId || 'all',
      totalMatches: results.length,
      overview,
      results,
    });
  } catch (error: any) {
    console.error('Error during content search:', error);
    res.status(500).json({ error: error.message || 'Error searching document content.' });
  }
});

// Get chunks for a specific document (for inspection / reading)
router.get('/:id/chunks', requireAuth, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  try {
    const doc = Storage.getDocumentById(id);
    if (!doc) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }

    const chunks = Storage.getChunksForDocument(id).map(({ embedding, ...c }: any) => c);
    res.json({
      document: doc,
      chunks,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching document chunks.' });
  }
});

// Upload and process any document type (PDF, DOCX, TXT, CSV, JSON, MD, Code, etc.)
router.post('/upload', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { name, type, size, base64, chunkSize, chunkOverlap } = req.body;

  if (!name || !base64) {
    res.status(400).json({ error: 'Missing required parameters: name and base64 content.' });
    return;
  }

  try {
    // 1. Decode base64 to Buffer
    const buffer = Buffer.from(base64, 'base64');

    // 2. Parse text content, pages, and format
    const parsedDoc = await DocumentProcessor.parseDocument(name, type || 'text/plain', buffer);

    // 3. Create document record in database
    const docRecord = Storage.createDocument(name, size || buffer.length, parsedDoc.fileType || type || 'DOCUMENT', parsedDoc.pageCount);

    // 4. Generate token-aware chunks
    const chunks = DocumentProcessor.chunkDocument(
      parsedDoc, 
      docRecord.id, 
      chunkSize || 600, 
      chunkOverlap || 100
    );

    // 5. Index chunks into vector store (with embeddings)
    await VectorStore.indexChunks(chunks);

    res.status(201).json({
      message: 'Document uploaded and indexed successfully.',
      document: docRecord,
      chunksCount: chunks.length,
    });
  } catch (error: any) {
    console.error('Error during document upload/indexing:', error);
    res.status(500).json({ error: error.message || 'Error processing document.' });
  }
});

// Delete all documents and their indexed vectors
router.delete('/all', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    Storage.clearAllDocuments();
    res.json({ message: 'All documents and vector indexes deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error clearing all documents.' });
  }
});

// Delete a document and its indexed vectors
router.delete('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  try {
    const doc = Storage.getDocumentById(id);
    if (!doc) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }

    Storage.deleteDocument(id);
    res.json({ message: 'Document and all indexed vectors deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error deleting document.' });
  }
});

export default router;
