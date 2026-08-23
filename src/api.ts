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

export const API = {
  // Auth
  async login(email: string, passwordString: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: passwordString }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    return data;
  },

  async register(email: string, passwordString: string, fullName: string) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: passwordString, fullName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    return data;
  },

  async getCurrentUser() {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch user');
    return data.user;
  },

  // Documents
  async getDocuments() {
    const res = await fetch(`${API_BASE}/documents`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch documents');
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
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to upload document');
    return data;
  },

  async searchDocumentContent(query: string, documentId?: string) {
    const params = new URLSearchParams({ query });
    if (documentId && documentId !== 'all') {
      params.append('documentId', documentId);
    }
    const res = await fetch(`${API_BASE}/documents/search?${params.toString()}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to search documents');
    return data;
  },

  async getDocumentChunks(id: string) {
    const res = await fetch(`${API_BASE}/documents/${id}/chunks`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch document chunks');
    return data;
  },

  async deleteDocument(id: string) {
    const res = await fetch(`${API_BASE}/documents/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete document');
    return data;
  },

  async clearAllDocuments() {
    const res = await fetch(`${API_BASE}/documents/all`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to clear all documents');
    return data;
  },

  // Chat
  async getChatSessions() {
    const res = await fetch(`${API_BASE}/chat`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch chat sessions');
    return data.chats;
  },

  async createChatSession(title?: string) {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ title }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create conversation');
    return data.chat;
  },

  async sendMessage(sessionId: string, content: string, settings: any, documentId?: string) {
    const res = await fetch(`${API_BASE}/chat/${sessionId}/message`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ content, settings, documentId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send message');
    return data.chat;
  },

  async clearChatMessages(id: string) {
    const res = await fetch(`${API_BASE}/chat/${id}/clear`, {
      method: 'POST',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to clear conversation');
    return data.chat;
  },

  async deleteChatSession(id: string) {
    const res = await fetch(`${API_BASE}/chat/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete conversation');
    return data;
  },

  async clearAllChats() {
    const res = await fetch(`${API_BASE}/chat/all`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to clear all conversations');
    return data;
  },

  async submitFeedback(messageId: string, isPositive: boolean, comment?: string) {
    const res = await fetch(`${API_BASE}/chat/feedback`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ messageId, isPositive, comment }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit feedback');
    return data;
  }
};
