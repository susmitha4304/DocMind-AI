import { GoogleGenAI } from '@google/genai';
import { Storage } from '../db/storage.js';
import { Chunk } from '../../src/types.js';

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    aiClient = new GoogleGenAI({
      apiKey: apiKey || 'dummy-key',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

/**
 * Calculates cosine similarity between two vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Lexical keyword score for catching exact terms, numbers, acronyms, or proper nouns
 */
export function lexicalScore(query: string, text: string): number {
  const qTokens = query.toLowerCase().split(/\W+/).filter(t => t.length > 1);
  if (qTokens.length === 0) return 0;
  const lowerText = text.toLowerCase();
  
  let matches = 0;
  for (const token of qTokens) {
    if (lowerText.includes(token)) {
      matches += 1;
    }
  }
  return matches / qTokens.length;
}

export interface SearchOptions {
  topK?: number;
  similarityThreshold?: number;
  documentId?: string;
  keywordBoost?: boolean;
}

export interface ContentSearchResult {
  chunk: Chunk;
  snippet: string;
  matchedKeywords: string[];
  score: number;
}

export const VectorStore = {
  /**
   * Generates embedding vector using Gemini gemini-embedding-001
   */
  async getEmbedding(text: string): Promise<number[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return this.getEmbeddingSimulated(text);
    }

    try {
      const client = getAIClient();
      const cleanText = text.substring(0, 3000).replace(/\s+/g, ' ').trim();
      if (!cleanText) return this.getEmbeddingSimulated(text);

      const response = await client.models.embedContent({
        model: 'gemini-embedding-001',
        contents: cleanText,
      });

      const res = response as any;
      if (res.embeddings && Array.isArray(res.embeddings) && res.embeddings[0]?.values) {
        return res.embeddings[0].values;
      } else if (res.embedding?.values && Array.isArray(res.embedding.values)) {
        return res.embedding.values;
      } else if (Array.isArray(res.values)) {
        return res.values;
      }
      return this.getEmbeddingSimulated(text);
    } catch (e) {
      console.warn('Embedding API call error, switching to resilient dense hash:', e);
      return this.getEmbeddingSimulated(text);
    }
  },

  /**
   * Dense character & word token n-gram hash vector generator
   */
  getEmbeddingSimulated(text: string): number[] {
    const dim = 768;
    const vec = new Float64Array(dim);
    const lower = text.toLowerCase();
    const words = lower.split(/\W+/).filter(w => w.length > 0);

    for (let wIdx = 0; wIdx < words.length; wIdx++) {
      const word = words[wIdx];
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash) + word.charCodeAt(i);
        hash |= 0;
      }
      const idx1 = Math.abs(hash) % dim;
      const idx2 = Math.abs((hash * 31) >> 1) % dim;
      const weight = 1 / Math.sqrt(wIdx + 1);
      vec[idx1] += 1.0 * weight;
      vec[idx2] += 0.5 * weight;
    }

    // 3-gram character hashing
    for (let i = 0; i < Math.min(lower.length - 2, 300); i++) {
      const code = lower.charCodeAt(i) + (lower.charCodeAt(i + 1) << 8) + (lower.charCodeAt(i + 2) << 16);
      const idx = Math.abs(code % dim);
      vec[idx] += 0.2;
    }

    // L2 Normalize
    let norm = 0;
    for (let i = 0; i < dim; i++) {
      norm += vec[i] * vec[i];
    }
    norm = Math.sqrt(norm);
    if (norm === 0) {
      for (let i = 0; i < dim; i++) vec[i] = 1 / Math.sqrt(dim);
      return Array.from(vec);
    }

    return Array.from(vec).map(v => v / norm);
  },

  /**
   * Indexes a list of document chunks into database
   */
  async indexChunks(chunks: Omit<Chunk, 'id'>[]): Promise<void> {
    const chunksWithEmbeddings = [];

    for (const chunk of chunks) {
      const embedding = await this.getEmbedding(chunk.text);
      chunksWithEmbeddings.push({
        ...chunk,
        embedding,
      });
    }

    Storage.createChunks(chunksWithEmbeddings);
  },

  /**
   * Hybrid RAG Retrieval (Semantic Cosine + Lexical Token Boost + Document Structure Prioritization)
   */
  async retrieve(
    query: string, 
    topK: number = 6, 
    similarityThreshold: number = 0.25,
    documentId?: string
  ): Promise<Chunk[]> {
    let allChunks = Storage.getAllChunks();
    if (allChunks.length === 0) return [];

    if (documentId && documentId !== 'all') {
      const filtered = allChunks.filter(c => c.documentId === documentId);
      if (filtered.length > 0) {
        allChunks = filtered;
      }
    }

    const queryVector = await this.getEmbedding(query);
    const isSummaryQuery = /\b(summar(y|ize)|overview|main points|takeaway|about|explain the doc|what is this)\b/i.test(query);

    const scored = allChunks.map((chunk, idx) => {
      const semSim = chunk.embedding ? cosineSimilarity(queryVector, chunk.embedding) : 0;
      const lexSim = lexicalScore(query, chunk.text);
      
      // Summary / general question boost for early document sections
      let positionBoost = 0;
      if (isSummaryQuery && chunk.pageNumber <= 2) {
        positionBoost = 0.15;
      }

      // Hybrid calculation
      let hybridScore = (semSim * 0.65) + (lexSim * 0.35) + positionBoost;
      if (lexSim > 0.4) {
        hybridScore = Math.max(hybridScore, lexSim);
      }

      return {
        ...chunk,
        similarityScore: parseFloat(Math.min(1, Math.max(0, hybridScore)).toFixed(4)),
        lexSim,
        semSim,
      };
    });

    // Sort descending by score
    scored.sort((a, b) => b.similarityScore - a.similarityScore);

    // Filter by threshold with graceful fallback
    const effectiveThreshold = Math.min(similarityThreshold, 0.2);
    let matched = scored.filter(c => c.similarityScore >= effectiveThreshold || c.lexSim > 0.15);

    // If threshold eliminated all chunks but we have chunks in the database/document,
    // take the top best candidates so the user gets relevant answers rather than empty failure
    if (matched.length === 0 && scored.length > 0) {
      matched = scored.slice(0, Math.min(topK, scored.length));
    }

    return matched.slice(0, topK).map(({ embedding, lexSim, semSim, ...chunk }: any) => chunk);
  },

  /**
   * Full-text & Semantic Search across document content for Search Explorer Tab
   */
  async searchContent(query: string, documentId?: string, limit: number = 20): Promise<ContentSearchResult[]> {
    if (!query.trim()) return [];
    const lowerQ = query.toLowerCase().trim();
    const keywords = lowerQ.split(/\s+/).filter(k => k.length > 1);

    let allChunks = Storage.getAllChunks();
    if (documentId && documentId !== 'all') {
      allChunks = allChunks.filter(c => c.documentId === documentId);
    }

    if (allChunks.length === 0) return [];

    const queryVector = await this.getEmbedding(query);
    const results: ContentSearchResult[] = [];

    for (const chunk of allChunks) {
      const textLower = chunk.text.toLowerCase();
      const matched = keywords.filter(k => textLower.includes(k));
      
      const semScore = chunk.embedding ? cosineSimilarity(queryVector, chunk.embedding) : 0;
      const lex = keywords.length > 0 ? (matched.length / keywords.length) : 0;
      const phraseMatch = textLower.includes(lowerQ) ? 0.3 : 0;
      const score = parseFloat(((semScore * 0.5) + (lex * 0.3) + phraseMatch).toFixed(3));

      // Match condition (either keyword match or semantic similarity)
      if (matched.length > 0 || semScore >= 0.22 || score >= 0.22 || phraseMatch > 0) {
        let snippet = chunk.text.trim();

        // If chunk is reasonably sized, keep it intact for full readability
        if (snippet.length > 500 && matched.length > 0) {
          const firstIndex = textLower.indexOf(matched[0]);
          // Find sentence / newline boundary before match
          let start = Math.max(0, firstIndex - 120);
          const prevPeriod = snippet.lastIndexOf('.', firstIndex);
          const prevNewline = snippet.lastIndexOf('\n', firstIndex);
          if (prevPeriod > start && prevPeriod !== -1) start = prevPeriod + 1;
          else if (prevNewline > start && prevNewline !== -1) start = prevNewline + 1;

          // Find sentence / newline boundary after match
          let end = Math.min(snippet.length, firstIndex + 320);
          const nextPeriod = snippet.indexOf('.', firstIndex + matched[0].length);
          if (nextPeriod !== -1 && nextPeriod <= end + 80) end = nextPeriod + 1;

          snippet = (start > 0 ? '... ' : '') + snippet.substring(start, end).trim() + (end < chunk.text.length ? ' ...' : '');
        }

        const { embedding, ...cleanChunk } = chunk;

        results.push({
          chunk: cleanChunk,
          snippet,
          matchedKeywords: matched.length > 0 ? matched : keywords.filter(k => textLower.includes(k)),
          score: Math.max(score, semScore, lex),
        });
      }
    }

    // Sort descending by score
    results.sort((a, b) => b.score - a.score);

    // If query has results, return up to limit
    if (results.length > 0) {
      return results.slice(0, limit);
    }

    // Fallback: If no exact threshold matches, return top 3 semantic candidates
    const fallbackScored = allChunks.map(chunk => {
      const semScore = chunk.embedding ? cosineSimilarity(queryVector, chunk.embedding) : 0;
      const { embedding, ...cleanChunk } = chunk;
      return {
        chunk: cleanChunk,
        snippet: chunk.text.length > 400 ? chunk.text.substring(0, 400) + '...' : chunk.text,
        matchedKeywords: [],
        score: semScore,
      };
    });

    fallbackScored.sort((a, b) => b.score - a.score);
    return fallbackScored.slice(0, Math.min(3, fallbackScored.length));
  }
};
