import { Router } from 'express';
import { Storage } from '../db/storage.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { RAGEngine } from '../services/ragEngine.js';
import { Message } from '../../src/types.js';

const router = Router();

// Get all chat sessions for the logged-in user
router.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const sessions = Storage.getChatsForUser(userId);
    res.json({ chats: sessions });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching chat sessions.' });
  }
});

// Start a new chat session
router.post('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const { title } = req.body;

  try {
    const userId = req.user!.id;
    const session = Storage.createChat(userId, title || 'New Conversation');
    res.status(201).json({ chat: session });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error creating chat session.' });
  }
});

// Clear all conversations for the user
router.delete('/all', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const userChats = Storage.getChatsForUser(userId);
    for (const chat of userChats) {
      Storage.deleteChat(chat.id);
    }
    res.json({ message: 'All conversations deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error clearing conversations.' });
  }
});

// Send a question to the chat session and run the RAG Q&A engine
router.post('/:id/message', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { content, settings, documentId } = req.body;

  if (!content || !content.trim()) {
    res.status(400).json({ error: 'Message content is required.' });
    return;
  }

  try {
    const chat = Storage.getChatById(id);
    if (!chat) {
      res.status(404).json({ error: 'Chat session not found.' });
      return;
    }

    // 1. Construct user message
    const userMsg: Message = {
      id: Math.random().toString(36).substring(2, 11),
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };

    // 2. Execute precision RAG with conversation history
    const ragSettings = settings || {};
    const threshold = ragSettings.similarityThreshold !== undefined ? ragSettings.similarityThreshold : 0.20;
    const topK = ragSettings.topK !== undefined ? ragSettings.topK : 8;
    const modelName = ragSettings.modelName || 'gemini-3.6-flash';

    const ragResult = await RAGEngine.answerQuestion(
      content.trim(), 
      topK, 
      threshold, 
      modelName,
      documentId,
      chat.messages
    );

    // 3. Construct assistant message with citations and confidence
    const assistantMsg: Message = {
      id: Math.random().toString(36).substring(2, 11),
      role: 'assistant',
      content: ragResult.content,
      timestamp: new Date().toISOString(),
      citations: ragResult.citations,
      confidenceScore: ragResult.confidenceScore,
    };

    // 4. Update conversation history
    const updatedMessages = [...chat.messages, userMsg, assistantMsg];
    
    // Auto-title generation based on first user message if title is default
    let newTitle = chat.title;
    if ((chat.title.startsWith('Conversation') || chat.title === 'New Conversation') && chat.messages.length === 0) {
      newTitle = content.trim().length > 30 ? content.trim().substring(0, 30) + '...' : content.trim();
    }

    const updatedChat = Storage.updateChat(id, updatedMessages, newTitle);

    res.json({ chat: updatedChat });
  } catch (error: any) {
    console.error('Error during Q&A processing:', error);
    res.status(500).json({ error: error.message || 'Error processing question.' });
  }
});

// Clear messages in a single chat session
router.post('/:id/clear', requireAuth, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  try {
    const chat = Storage.getChatById(id);
    if (!chat) {
      res.status(404).json({ error: 'Chat session not found.' });
      return;
    }

    const updatedChat = Storage.updateChat(id, []);
    res.json({ message: 'Conversation cleared.', chat: updatedChat });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error clearing conversation.' });
  }
});

// Delete a specific chat session
router.delete('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  try {
    const chat = Storage.getChatById(id);
    if (!chat) {
      res.status(404).json({ error: 'Chat session not found.' });
      return;
    }

    Storage.deleteChat(id);
    res.json({ message: 'Conversation deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error deleting conversation.' });
  }
});

// Submit user feedback (positive or negative)
router.post('/feedback', requireAuth, (req: AuthenticatedRequest, res) => {
  const { messageId, isPositive, comment } = req.body;

  if (!messageId || isPositive === undefined) {
    res.status(400).json({ error: 'Missing messageId or isPositive status.' });
    return;
  }

  try {
    const feedback = Storage.createFeedback(messageId, isPositive, comment);
    res.status(201).json({ message: 'Feedback stored successfully.', feedback });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error storing feedback.' });
  }
});

export default router;
