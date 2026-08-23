export interface User {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
}

export interface Document {
  id: string;
  name: string;
  size: number;
  type: string;
  pageCount: number;
  uploadDate: string;
}

export interface Chunk {
  id: string;
  documentId: string;
  docName: string;
  text: string;
  pageNumber: number;
  similarityScore?: number;
}

export interface ContentSearchResult {
  chunk: Chunk;
  snippet: string;
  matchedKeywords: string[];
  score: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: Chunk[];
  confidenceScore?: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface Feedback {
  id: string;
  messageId: string;
  isPositive: boolean;
  comment?: string;
  createdAt: string;
}

export interface UserSettings {
  theme: 'light' | 'dark';
  similarityThreshold: number;
  modelName: string;
  topK: number;
  chunkSize: number;
  chunkOverlap: number;
}
