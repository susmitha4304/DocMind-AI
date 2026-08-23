const API_BASE = '/api';

function getHeaders(): HeadersInit {
  const token = localStorage.getItem('docmind_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function parseResponse(res: Response, defaultErrMsg: string) {
  const contentType = res.headers.get('content-type') || '';
  let data: any = null;

  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    // If text or HTML returned (e.g. 502 Bad Gateway or 404 HTML)
    const text = await res.text();
    if (!res.ok) {
      // Strip HTML tags for clean error message
      const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      throw new Error(cleanText || `Server returned error (${res.status} ${res.statusText})`);
    }
    throw new Error(defaultErrMsg);
  }

  if (!res.ok) {
    throw new Error(data?.error || data?.message || defaultErrMsg);
  }

  return data;
}

export const API = {
  // Auth
  async login(email: string, passwordString: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: passwordString }),
    });
    return parseResponse(res, 'Login failed');
  },

  async register(email: string, passwordString: string, fullName: string) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: passwordString, fullName }),
    });
    return parseResponse(res, 'Registration failed');
  },

  async getCurrentUser() {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getHeaders(),
    });
    const data = await parseResponse(res, 'Failed to fetch user');
    return data.user;
  },

  // Documents
  async getDocuments() {
    const res = await fetch(`${API_BASE}/documents`, {
      headers: getHeaders(),
    });
    const data = await parseResponse(res, 'Failed to fetch documents');
    return data.documents;
  },

  async uploadDocument(
    name: string, 
    type: string, 
    size: number, 
    base64: string, 
    chunkSize?: number, 
    chunkOverlap?: number
  ) {
    const res = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, type, size, base64, chunkSize, chunkOverlap }),
    });
    return parseResponse(res, 'Failed to upload document');
  },

  async searchDocumentContent(query: string, documentId?: string) {
    const params = new URLSearchParams({ query });
    if (documentId && documentId !== 'all') {
      params.append('documentId', documentId);
    }
    const res = await fetch(`${API_BASE}/documents/search?${params.toString()}`, {
      headers: getHeaders(),
    });
    return parseResponse(res, 'Failed to search documents');
  },

  async getDocumentChunks(id: string) {
    const res = await fetch(`${API_BASE}/documents/${id}/chunks`, {
      headers: getHeaders(),
    });
    return parseResponse(res, 'Failed to fetch document chunks');
  },

  async deleteDocument(id: string) {
    const res = await fetch(`${API_BASE}/documents/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return parseResponse(res, 'Failed to delete document');
  },

  async clearAllDocuments() {
    const res = await fetch(`${API_BASE}/documents/all`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return parseResponse(res, 'Failed to clear all documents');
  },

  // Chat
  async getChatSessions() {
    const res = await fetch(`${API_BASE}/chat`, {
      headers: getHeaders(),
    });
    const data = await parseResponse(res, 'Failed to fetch chat sessions');
    return data.chats;
  },

  async createChatSession(title?: string) {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ title }),
    });
    const data = await parseResponse(res, 'Failed to create conversation');
    return data.chat;
  },

  async sendMessage(sessionId: string, content: string, settings: any, documentId?: string) {
    const res = await fetch(`${API_BASE}/chat/${sessionId}/message`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ content, settings, documentId }),
    });
    const data = await parseResponse(res, 'Failed to send message');
    return data.chat;
  },

  async clearChatMessages(id: string) {
    const res = await fetch(`${API_BASE}/chat/${id}/clear`, {
      method: 'POST',
      headers: getHeaders(),
    });
    const data = await parseResponse(res, 'Failed to clear conversation');
    return data.chat;
  },

  async deleteChatSession(id: string) {
    const res = await fetch(`${API_BASE}/chat/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return parseResponse(res, 'Failed to delete conversation');
  },

  async clearAllChats() {
    const res = await fetch(`${API_BASE}/chat/all`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return parseResponse(res, 'Failed to clear all conversations');
  },

  async submitFeedback(messageId: string, isPositive: boolean, comment?: string) {
    const res = await fetch(`${API_BASE}/chat/feedback`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ messageId, isPositive, comment }),
    });
    return parseResponse(res, 'Failed to submit feedback');
  }
};
