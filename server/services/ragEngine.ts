import { GoogleGenAI } from '@google/genai';
import { VectorStore } from './vectorStore.js';
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

export interface RAGAnswerResult {
  content: string;
  citations: Chunk[];
  confidenceScore: number;
  retrievedCount: number;
}

export const RAGEngine = {
  /**
   * Execute precision Retrieval-Augmented Generation query
   */
  async answerQuestion(
    query: string, 
    topK: number = 8, 
    threshold: number = 0.20,
    customModel?: string,
    documentId?: string,
    conversationHistory?: { role: string; content: string }[]
  ): Promise<RAGAnswerResult> {
    const allStoredChunks = Storage.getAllChunks();
    if (allStoredChunks.length === 0) {
      return {
        content: "No documents have been uploaded or indexed yet. Please upload your presentation, PDF, or documents using the **Upload Documents** tab to begin asking questions.",
        citations: [],
        confidenceScore: 0,
        retrievedCount: 0,
      };
    }

    // Adaptive retrieval count: for broad or multi-question queries, retrieve more context
    const isBroadQuery = /\b(questions?|qb|unit|units|exam|all|summary|compare|list|explain|difference|overview|chapter|presentation|slides?)\b/i.test(query);
    const effectiveTopK = isBroadQuery ? Math.max(topK, 12) : topK;

    // 1. Retrieve matching chunks using hybrid semantic + keyword retrieval
    const matchingChunks = await VectorStore.retrieve(query, effectiveTopK, threshold, documentId);

    // 2. If no chunks retrieved, attempt a broader fallback search without strict threshold
    let finalChunks = matchingChunks;
    if (finalChunks.length === 0) {
      finalChunks = await VectorStore.retrieve(query, 6, 0.05, documentId);
    }

    if (finalChunks.length === 0) {
      return {
        content: "I couldn't find matching information in the uploaded document(s) for your specific query. Please try rephrasing your question or verify the uploaded document content.",
        citations: [],
        confidenceScore: 0,
        retrievedCount: 0,
      };
    }

    // 3. Compute overall confidence score from top retrieved matches
    const topScore = finalChunks[0]?.similarityScore || 0.5;
    const avgScore = finalChunks.slice(0, 3).reduce((acc, c) => acc + (c.similarityScore || 0.5), 0) / Math.min(3, finalChunks.length);
    const confidenceScore = parseFloat(((topScore * 0.7) + (avgScore * 0.3)).toFixed(3));

    // 4. Assemble source chunks as structured context
    const contextBlocks = finalChunks.map((chunk, index) => {
      return `=== EXCERPT #${index + 1} [Document: "${chunk.docName}", Slide/Page: ${chunk.pageNumber}] ===\n${chunk.text}\n`;
    }).join('\n----------------------------------------\n');

    // 5. System instructions for comprehensive, world-class AI responses like ChatGPT & Gemini
    const systemInstruction = `You are DocMind AI, a world-class, intelligent AI study and document analysis assistant like ChatGPT and Gemini.
You analyze uploaded documents (PowerPoint presentations, PDFs, Word docs, textbooks, notes) and provide high-quality, clear, engaging, and exam-ready answers.

CORE PRINCIPLES:
1. Direct, Structured & Conversational: Answer directly with clear structure, bold highlights, concise bullet points, and numbered lists where appropriate.
2. Step-by-Step Fulfillment: If the user asks for a specific number of questions (e.g. "give me 5 questions at a time", "questions 1 to 5"), follow their exact pacing and format instructions.
3. Visuals & Flowcharts: When explaining processes, pipelines, comparisons, or architectures, provide clean, readable text diagrams/flowcharts (e.g. "3D Models / Geometry → Scene & Lighting → Rendering → 2D Image") and comparison markdown tables.
4. Exam-Ready Clarity: Keep explanations crisp, simple to understand, and easy to memorize. Include key definitions, formulas, real-world examples, and differences.
5. Grounded with Smart Synthesis: Base core facts, terminology, and classifications faithfully on the provided DOCUMENT CONTEXT. If the document is brief or concise on a topic, explain the core concepts clearly in plain English while remaining true to the material.
6. Clean Formatting: Do not output system headers, raw XML tags, or binary corruption. Write beautiful, clean Markdown.`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Direct synthesis when API key is not configured
      const topDocs = Array.from(new Set(finalChunks.map(c => c.docName))).join(', ');
      const synthesizedPoints = finalChunks.slice(0, 4).map(c => 
        `- **[${c.docName}, Page/Slide ${c.pageNumber}]**: ${c.text.substring(0, 240)}...`
      ).join('\n\n');

      return {
        content: `Based on **${topDocs}**, here is the document summary answering your query:\n\n${synthesizedPoints}`,
        citations: finalChunks,
        confidenceScore,
        retrievedCount: finalChunks.length,
      };
    }

    try {
      const client = getAIClient();
      const primaryModel = customModel || 'gemini-3.6-flash';
      const fallbackModels = [primaryModel, 'gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];
      const uniqueModels = Array.from(new Set(fallbackModels));

      // Build sanitized multi-turn contents for Gemini
      const contentsPayload: any[] = [];

      if (conversationHistory && conversationHistory.length > 0) {
        const validMsgs = conversationHistory
          .filter(m => m && m.content && m.content.trim())
          .slice(-6);

        let lastRole: string | null = null;
        for (const msg of validMsgs) {
          const role = msg.role === 'user' ? 'user' : 'model';
          if (contentsPayload.length === 0 && role !== 'user') {
            continue;
          }
          if (role === lastRole) {
            contentsPayload[contentsPayload.length - 1].parts[0].text += '\n\n' + msg.content.trim();
          } else {
            contentsPayload.push({
              role,
              parts: [{ text: msg.content.trim() }]
            });
            lastRole = role;
          }
        }
      }

      // Append current user query with context
      const promptText = `DOCUMENT CONTEXT FROM UPLOADED FILES:
${contextBlocks}

USER QUERY:
${query}

Please provide a structured, comprehensive, and clear response following the user instructions:`;

      if (contentsPayload.length > 0 && contentsPayload[contentsPayload.length - 1].role === 'user') {
        contentsPayload[contentsPayload.length - 1].parts[0].text += `\n\n${promptText}`;
      } else {
        contentsPayload.push({
          role: 'user',
          parts: [{ text: promptText }]
        });
      }

      let textAnswer: string | null = null;
      let lastError: any = null;

      for (const modelToTry of uniqueModels) {
        try {
          const response = await client.models.generateContent({
            model: modelToTry,
            contents: contentsPayload,
            config: {
              systemInstruction,
              temperature: 0.2,
            }
          });

          if (response.text && response.text.trim()) {
            textAnswer = response.text.trim();
            break;
          }
        } catch (modelErr: any) {
          lastError = modelErr;
          console.warn(`Model ${modelToTry} attempt failed, trying next fallback:`, modelErr.message || modelErr);
        }
      }

      if (!textAnswer) {
        throw lastError || new Error('All model attempts failed to return text.');
      }

      return {
        content: textAnswer,
        citations: finalChunks,
        confidenceScore,
        retrievedCount: finalChunks.length,
      };
    } catch (e: any) {
      console.error('RAG Engine LLM call failed:', e);
      const topChunk = finalChunks[0];
      const cleanSnippet = topChunk.text.substring(0, 350).trim();
      return {
        content: `Based on **${topChunk.docName}** (Slide/Page ${topChunk.pageNumber}):\n\n${cleanSnippet}`,
        citations: finalChunks,
        confidenceScore,
        retrievedCount: finalChunks.length,
      };
    }
  },

  /**
   * Generates a concise NotebookLM / ChatGPT-style overview for search queries
   */
  async generateSearchOverview(query: string, chunks: Chunk[]): Promise<string | null> {
    if (!chunks || chunks.length === 0) return null;

    const topSnippets = chunks.slice(0, 4).map((c, i) => `[Source ${i+1}: ${c.docName}, Page/Slide ${c.pageNumber}]:\n${c.text}`).join('\n\n');
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      const first = chunks[0];
      return `Key match found in **${first.docName}** (Slide/Page ${first.pageNumber}): "${first.text.substring(0, 220).trim()}..."`;
    }

    try {
      const client = getAIClient();
      const modelsToTry = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.7-flash', 'gemini-flash-latest'];
      
      for (const m of modelsToTry) {
        try {
          const response = await client.models.generateContent({
            model: m,
            contents: `Generate a concise, insightful 2-4 sentence overview answering the user search query based strictly on these document excerpts:\n\nQUERY: ${query}\n\nEXCERPTS:\n${topSnippets}`,
            config: {
              systemInstruction: 'You are an intelligent document research assistant. Write clean, concise, direct summaries highlighting key answers.',
              temperature: 0.2,
            }
          });

          if (response.text && response.text.trim()) {
            return response.text.trim();
          }
        } catch {
          // try next model
        }
      }
      return null;
    } catch {
      return null;
    }
  }
};

