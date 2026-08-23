import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { User, Document, Chunk, ChatSession, Feedback } from '../../src/types.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

interface DatabaseSchema {
  users: (User & { passwordHash: string })[];
  documents: Document[];
  chunks: (Chunk & { embedding?: number[] })[];
  chats: (ChatSession & { userId: string })[];
  feedbacks: Feedback[];
}

function initDB(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      console.error('Error reading database file, resetting database:', e);
    }
  }

  const defaultDB: DatabaseSchema = {
    users: [],
    documents: [],
    chunks: [],
    chats: [],
    feedbacks: [],
  };

  fs.writeFileSync(DB_FILE, JSON.stringify(defaultDB, null, 2), 'utf8');
  return defaultDB;
}

const db = initDB();

function saveDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving database:', e);
  }
}

export const Storage = {
  // Users
  getUserByEmail(email: string) {
    return db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  },

  getUserById(id: string) {
    return db.users.find(u => u.id === id);
  },

  async createUser(email: string, passwordPlain: string, fullName: string): Promise<User> {
    const existing = this.getUserByEmail(email);
    if (existing) {
      throw new Error('User already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordPlain, salt);

    const newUser = {
      id: Math.random().toString(36).substring(2, 11),
      email,
      fullName,
      createdAt: new Date().toISOString(),
      passwordHash,
    };

    db.users.push(newUser);
    saveDB();

    const { passwordHash: _, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  },

  // Documents
  getDocuments(): Document[] {
    return db.documents;
  },

  getDocumentById(id: string): Document | undefined {
    return db.documents.find(d => d.id === id);
  },

  createDocument(name: string, size: number, type: string, pageCount: number): Document {
    const newDoc: Document = {
      id: Math.random().toString(36).substring(2, 11),
      name,
      size,
      type,
      pageCount,
      uploadDate: new Date().toISOString(),
    };

    db.documents.push(newDoc);
    saveDB();
    return newDoc;
  },

  deleteDocument(id: string) {
    db.documents = db.documents.filter(d => d.id !== id);
    db.chunks = db.chunks.filter(c => c.documentId !== id);
    saveDB();
  },

  clearAllDocuments() {
    db.documents = [];
    db.chunks = [];
    saveDB();
  },

  // Chunks
  createChunks(chunksList: { documentId: string; docName: string; text: string; pageNumber: number; embedding?: number[] }[]) {
    const newChunks = chunksList.map(c => ({
      id: Math.random().toString(36).substring(2, 11),
      ...c,
    }));

    db.chunks.push(...newChunks);
    saveDB();
    return newChunks;
  },

  getChunksForDocument(documentId: string): Chunk[] {
    return db.chunks.filter(c => c.documentId === documentId);
  },

  getAllChunks() {
    return db.chunks;
  },

  // ChatSessions
  getChatsForUser(userId: string): ChatSession[] {
    return db.chats.filter(c => c.userId === userId);
  },

  getChatById(id: string): ChatSession | undefined {
    return db.chats.find(c => c.id === id);
  },

  createChat(userId: string, title: string): ChatSession {
    const newChat: ChatSession & { userId: string } = {
      id: Math.random().toString(36).substring(2, 11),
      userId,
      title,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.chats.push(newChat);
    saveDB();
    return newChat;
  },

  updateChat(id: string, messages: any[], title?: string): ChatSession {
    const chat = db.chats.find(c => c.id === id);
    if (!chat) {
      throw new Error('Chat session not found');
    }

    chat.messages = messages;
    chat.updatedAt = new Date().toISOString();
    if (title) {
      chat.title = title;
    }

    saveDB();
    return chat;
  },

  deleteChat(id: string) {
    db.chats = db.chats.filter(c => c.id !== id);
    saveDB();
  },

  // Feedbacks
  createFeedback(messageId: string, isPositive: boolean, comment?: string): Feedback {
    const newFeedback: Feedback = {
      id: Math.random().toString(36).substring(2, 11),
      messageId,
      isPositive,
      comment,
      createdAt: new Date().toISOString(),
    };

    db.feedbacks.push(newFeedback);
    saveDB();
    return newFeedback;
  },
};
