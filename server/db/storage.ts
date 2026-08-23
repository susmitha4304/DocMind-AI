import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { initializeApp, getApps, getApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { User, Document, Chunk, ChatSession, Feedback } from '../../src/types.js';

// Local disk persistence fallback (cached mirror)
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

interface LocalDatabaseSchema {
  users: (User & { passwordHash: string })[];
  documents: Document[];
  chunks: (Chunk & { embedding?: number[] })[];
  chats: (ChatSession & { userId: string })[];
  feedbacks: Feedback[];
}

function initLocalFallbackDB(): LocalDatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      console.error('Error reading local fallback database file:', e);
    }
  }

  const defaultDB: LocalDatabaseSchema = {
    users: [],
    documents: [],
    chunks: [],
    chats: [],
    feedbacks: [],
  };

  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDB, null, 2), 'utf8');
  } catch (e) {
    // Ignore write errors if read-only filesystem
  }
  return defaultDB;
}

const localCache = initLocalFallbackDB();

function saveLocalCache() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(localCache, null, 2), 'utf8');
  } catch (e) {
    // Fallback if local file system error occurs
  }
}

// Initialize Firestore Admin Client
let firestoreAdmin: Firestore | null = null;

function getFirestoreDB(): Firestore | null {
  if (firestoreAdmin) return firestoreAdmin;

  try {
    let adminApp: App;
    if (!getApps().length) {
      adminApp = initializeApp();
    } else {
      adminApp = getApp();
    }

    let config: any = {};
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    firestoreAdmin = getFirestore(adminApp, config.firestoreDatabaseId || undefined);
    return firestoreAdmin;
  } catch (e) {
    console.warn('Firestore Admin initialization notice (falling back to fast memory/cache):', e);
    return null;
  }
}

// Helper to sanitize Firestore undefined values
function cleanFirestoreDoc<T>(doc: any): T {
  const result: any = { ...doc };
  Object.keys(result).forEach(key => {
    if (result[key] === undefined) {
      delete result[key];
    }
  });
  return result;
}

export const Storage = {
  // Sync in-memory cache with Cloud Firestore upon startup or query
  async syncFromCloud(): Promise<void> {
    const fdb = getFirestoreDB();
    if (!fdb) return;

    try {
      // Sync Users
      const usersSnap = await fdb.collection('users').get();
      if (!usersSnap.empty) {
        localCache.users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      }

      // Sync Documents
      const docsSnap = await fdb.collection('documents').get();
      if (!docsSnap.empty) {
        localCache.documents = docsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      }

      // Sync Chunks
      const chunksSnap = await fdb.collection('chunks').get();
      if (!chunksSnap.empty) {
        localCache.chunks = chunksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      }

      // Sync Chats
      const chatsSnap = await fdb.collection('chats').get();
      if (!chatsSnap.empty) {
        localCache.chats = chatsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      }

      // Sync Feedbacks
      const feedbacksSnap = await fdb.collection('feedbacks').get();
      if (!feedbacksSnap.empty) {
        localCache.feedbacks = feedbacksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      }

      saveLocalCache();
    } catch (e) {
      console.warn('Could not complete full Firestore sync (using local records):', e);
    }
  },

  // USERS
  getUserByEmail(email: string) {
    return localCache.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  },

  async getUserByEmailAsync(email: string) {
    const cached = this.getUserByEmail(email);
    if (cached) return cached;

    const fdb = getFirestoreDB();
    if (fdb) {
      try {
        const snap = await fdb.collection('users').where('email', '==', email.toLowerCase().trim()).limit(1).get();
        if (!snap.empty) {
          const doc = snap.docs[0];
          const user = { id: doc.id, ...doc.data() } as any;
          const idx = localCache.users.findIndex(u => u.id === user.id);
          if (idx >= 0) localCache.users[idx] = user;
          else localCache.users.push(user);
          saveLocalCache();
          return user;
        }
      } catch (e) {
        console.warn('Error fetching user from Firestore:', e);
      }
    }
    return null;
  },

  getUserById(id: string) {
    return localCache.users.find(u => u.id === id);
  },

  async createUser(email: string, passwordPlain: string, fullName: string): Promise<User> {
    const existing = await this.getUserByEmailAsync(email);
    if (existing) {
      throw new Error('User with this email already exists.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordPlain, salt);
    const userId = 'usr_' + Math.random().toString(36).substring(2, 11);

    const newUserRecord = {
      id: userId,
      email: email.toLowerCase().trim(),
      fullName: fullName.trim(),
      createdAt: new Date().toISOString(),
      passwordHash,
    };

    localCache.users.push(newUserRecord);
    saveLocalCache();

    // Persist to Cloud Firestore
    const fdb = getFirestoreDB();
    if (fdb) {
      try {
        await fdb.collection('users').doc(userId).set(cleanFirestoreDoc(newUserRecord));
      } catch (e) {
        console.error('Error saving user to Firestore:', e);
      }
    }

    const { passwordHash: _, ...userWithoutPassword } = newUserRecord;
    return userWithoutPassword;
  },

  // DOCUMENTS
  getDocuments(): Document[] {
    return localCache.documents;
  },

  getDocumentById(id: string): Document | undefined {
    return localCache.documents.find(d => d.id === id);
  },

  createDocument(name: string, size: number, type: string, pageCount: number): Document {
    const docId = 'doc_' + Math.random().toString(36).substring(2, 11);
    const newDoc: Document = {
      id: docId,
      name,
      size,
      type,
      pageCount,
      uploadDate: new Date().toISOString(),
    };

    localCache.documents.push(newDoc);
    saveLocalCache();

    // Persist to Cloud Firestore
    const fdb = getFirestoreDB();
    if (fdb) {
      fdb.collection('documents').doc(docId).set(cleanFirestoreDoc(newDoc)).catch(e => {
        console.error('Error writing document to Firestore:', e);
      });
    }

    return newDoc;
  },

  deleteDocument(id: string) {
    localCache.documents = localCache.documents.filter(d => d.id !== id);
    localCache.chunks = localCache.chunks.filter(c => c.documentId !== id);
    saveLocalCache();

    const fdb = getFirestoreDB();
    if (fdb) {
      fdb.collection('documents').doc(id).delete().catch(console.error);
      fdb.collection('chunks').where('documentId', '==', id).get().then(snap => {
        const batch = fdb.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        return batch.commit();
      }).catch(console.error);
    }
  },

  clearAllDocuments() {
    localCache.documents = [];
    localCache.chunks = [];
    saveLocalCache();

    const fdb = getFirestoreDB();
    if (fdb) {
      fdb.collection('documents').get().then(snap => {
        const batch = fdb.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        return batch.commit();
      }).catch(console.error);

      fdb.collection('chunks').get().then(snap => {
        const batch = fdb.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        return batch.commit();
      }).catch(console.error);
    }
  },

  // CHUNKS
  createChunks(chunksList: { documentId: string; docName: string; text: string; pageNumber: number; embedding?: number[] }[]) {
    const newChunks = chunksList.map(c => ({
      id: 'chk_' + Math.random().toString(36).substring(2, 11),
      ...c,
    }));

    localCache.chunks.push(...newChunks);
    saveLocalCache();

    // Persist chunks in batch to Firestore
    const fdb = getFirestoreDB();
    if (fdb && newChunks.length > 0) {
      const batch = fdb.batch();
      newChunks.forEach(chunk => {
        const ref = fdb.collection('chunks').doc(chunk.id);
        batch.set(ref, cleanFirestoreDoc(chunk));
      });
      batch.commit().catch(e => {
        console.error('Error writing chunks batch to Firestore:', e);
      });
    }

    return newChunks;
  },

  getChunksForDocument(documentId: string): Chunk[] {
    return localCache.chunks.filter(c => c.documentId === documentId);
  },

  getAllChunks() {
    return localCache.chunks;
  },

  // CHAT SESSIONS
  getChatsForUser(userId: string): ChatSession[] {
    return localCache.chats.filter(c => c.userId === userId);
  },

  getChatById(id: string): ChatSession | undefined {
    return localCache.chats.find(c => c.id === id);
  },

  createChat(userId: string, title: string): ChatSession {
    const chatId = 'chat_' + Math.random().toString(36).substring(2, 11);
    const newChat: ChatSession & { userId: string } = {
      id: chatId,
      userId,
      title,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    localCache.chats.push(newChat);
    saveLocalCache();

    const fdb = getFirestoreDB();
    if (fdb) {
      fdb.collection('chats').doc(chatId).set(cleanFirestoreDoc(newChat)).catch(e => {
        console.error('Error saving chat to Firestore:', e);
      });
    }

    return newChat;
  },

  updateChat(id: string, messages: any[], title?: string): ChatSession {
    const chat = localCache.chats.find(c => c.id === id);
    if (!chat) {
      throw new Error('Chat session not found');
    }

    chat.messages = messages;
    chat.updatedAt = new Date().toISOString();
    if (title) {
      chat.title = title;
    }

    saveLocalCache();

    const fdb = getFirestoreDB();
    if (fdb) {
      fdb.collection('chats').doc(id).set(cleanFirestoreDoc(chat), { merge: true }).catch(console.error);
    }

    return chat;
  },

  deleteChat(id: string) {
    localCache.chats = localCache.chats.filter(c => c.id !== id);
    saveLocalCache();

    const fdb = getFirestoreDB();
    if (fdb) {
      fdb.collection('chats').doc(id).delete().catch(console.error);
    }
  },

  // FEEDBACKS
  createFeedback(messageId: string, isPositive: boolean, comment?: string): Feedback {
    const feedbackId = 'fb_' + Math.random().toString(36).substring(2, 11);
    const newFeedback: Feedback = {
      id: feedbackId,
      messageId,
      isPositive,
      comment,
      createdAt: new Date().toISOString(),
    };

    localCache.feedbacks.push(newFeedback);
    saveLocalCache();

    const fdb = getFirestoreDB();
    if (fdb) {
      fdb.collection('feedbacks').doc(feedbackId).set(cleanFirestoreDoc(newFeedback)).catch(console.error);
    }

    return newFeedback;
  },
};

// Initiate background initial sync
Storage.syncFromCloud().catch(() => {});
