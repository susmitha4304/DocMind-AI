import React, { useState, useEffect } from 'react';
import { API } from './api.js';
import { User, Document, ChatSession, UserSettings } from './types.js';
import Auth from './components/Auth.js';
import ChatTab from './components/ChatTab.js';
import SearchTab from './components/SearchTab.js';
import UploadTab from './components/UploadTab.js';
import DocumentsTab from './components/DocumentsTab.js';
import SettingsTab from './components/SettingsTab.js';
import { 
  MessageSquare, 
  Search,
  UploadCloud, 
  Settings as SettingsIcon, 
  LogOut, 
  Trash2, 
  Layers, 
  Plus, 
  Menu, 
  X, 
  FileText,
  User as UserIcon,
  Sun,
  Moon,
  Sparkles,
  Bot
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState<'auth' | 'dashboard'>('auth');
  const [activeTab, setActiveTab] = useState<'chat' | 'search' | 'upload' | 'documents' | 'settings'>('chat');
  
  // Data State
  const [documents, setDocuments] = useState<Document[]>([]);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatSearchQuery, setChatSearchQuery] = useState<string>('');
  
  // Settings
  const [settings, setSettings] = useState<UserSettings>({
    theme: 'light',
    similarityThreshold: 0.25,
    modelName: 'gemini-3.7-flash',
    topK: 6,
    chunkSize: 600,
    chunkOverlap: 100,
  });

  // UI States
  const [loadingApp, setLoadingApp] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Initialize App session
  useEffect(() => {
    async function initSession() {
      const token = localStorage.getItem('docmind_token');
      if (token) {
        try {
          const currentUser = await API.getCurrentUser();
          setUser(currentUser);
          setPage('dashboard');
          
          // Load default theme from user preference saved
          const savedTheme = localStorage.getItem('docmind_theme') as 'light' | 'dark';
          if (savedTheme) {
            setSettings(prev => ({ ...prev, theme: savedTheme }));
            if (savedTheme === 'dark') {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          }

          // Fetch initial dashboard contents
          await refreshData();
        } catch (e) {
          console.error('Session expired or invalid:', e);
          localStorage.removeItem('docmind_token');
        }
      }
      setLoadingApp(false);
    }
    initSession();
  }, []);

  const refreshData = async () => {
    try {
      const [docsList, chatsList] = await Promise.all([
        API.getDocuments(),
        API.getChatSessions(),
      ]);
      setDocuments(docsList);
      setChats(chatsList);

      // Auto-select latest chat if none is active
      if (chatsList.length > 0 && !activeChatId) {
        setActiveChatId(chatsList[0].id);
      }
    } catch (e) {
      console.error('Error loading documents or chat sessions:', e);
    }
  };

  const handleAuthSuccess = async (authUser: User, token: string) => {
    localStorage.setItem('docmind_token', token);
    setUser(authUser);
    setPage('dashboard');
    setLoadingApp(true);
    await refreshData();
    setLoadingApp(false);
  };

  const handleSignOut = () => {
    localStorage.removeItem('docmind_token');
    setUser(null);
    setPage('auth');
    setDocuments([]);
    setChats([]);
    setActiveChatId(null);
  };

  const handleSettingsChange = (newSettings: UserSettings) => {
    setSettings(newSettings);
    localStorage.setItem('docmind_theme', newSettings.theme);
    if (newSettings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const toggleTheme = () => {
    const next = settings.theme === 'light' ? 'dark' : 'light';
    handleSettingsChange({ ...settings, theme: next });
  };

  // Chat Actions
  const handleCreateNewChat = async () => {
    try {
      const newSession = await API.createChatSession(`Conversation ${chats.length + 1}`);
      setChats(prev => [newSession, ...prev]);
      setActiveChatId(newSession.id);
      setActiveTab('chat');
      setMobileMenuOpen(false);
    } catch (e) {
      console.error('Failed to create new conversation:', e);
    }
  };

  const handleDeleteChat = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await API.deleteChatSession(id);
      setChats(prev => prev.filter(c => c.id !== id));
      if (activeChatId === id) {
        const remaining = chats.filter(c => c.id !== id);
        setActiveChatId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (e) {
      console.error('Failed to delete chat:', e);
    }
  };

  const handleClearAllChats = async () => {
    try {
      await API.clearAllChats();
      setChats([]);
      setActiveChatId(null);
    } catch (e) {
      console.error('Failed to clear conversations:', e);
    }
  };

  const handleClearChatMessages = async (id: string) => {
    try {
      const res = await API.clearChatMessages(id);
      setChats(prev => prev.map(c => c.id === id ? res.chat : c));
    } catch (e) {
      console.error('Failed to clear messages:', e);
    }
  };

  const handleSendMessage = async (content: string, documentId?: string) => {
    if (!activeChatId) {
      // Create session first if none active
      try {
        const newSession = await API.createChatSession(content.length > 25 ? content.substring(0, 25) + '...' : content);
        setChats(prev => [newSession, ...prev]);
        setActiveChatId(newSession.id);
        
        setLoadingMessage(true);
        const updatedChat = await API.sendMessage(newSession.id, content, {
          similarityThreshold: settings.similarityThreshold,
          modelName: settings.modelName,
          topK: settings.topK,
        }, documentId);
        setChats(prev => prev.map(c => c.id === newSession.id ? updatedChat : c));
      } catch (e) {
        console.error('Failed to send message with auto-created chat:', e);
      } finally {
        setLoadingMessage(false);
      }
      return;
    }

    setLoadingMessage(true);
    try {
      const updatedChat = await API.sendMessage(activeChatId, content, {
        similarityThreshold: settings.similarityThreshold,
        modelName: settings.modelName,
        topK: settings.topK,
      }, documentId);

      // Update chats list
      setChats(prev => prev.map(c => c.id === activeChatId ? updatedChat : c));
    } catch (e) {
      console.error('Failed to process Q&A:', e);
    } finally {
      setLoadingMessage(false);
    }
  };

  // Document Actions
  const handleDeleteDocument = async (id: string) => {
    try {
      await API.deleteDocument(id);
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (e) {
      console.error('Failed to delete document:', e);
    }
  };

  const handleClearAllDocuments = async () => {
    try {
      await API.clearAllDocuments();
      setDocuments([]);
    } catch (e) {
      console.error('Failed to clear all documents:', e);
    }
  };

  const handleAskInChat = async (prompt: string) => {
    setActiveTab('chat');
    if (!activeChatId) {
      await handleCreateNewChat();
    }
    // Delay slightly to let chat view render
    setTimeout(() => {
      handleSendMessage(prompt);
    }, 150);
  };

  const filteredChats = chats.filter((chat) => {
    if (!chatSearchQuery.trim()) return true;
    const q = chatSearchQuery.toLowerCase().trim();
    if (chat.title.toLowerCase().includes(q)) return true;
    if (chat.messages && chat.messages.some((m) => m.content.toLowerCase().includes(q))) return true;
    return false;
  });

  if (loadingApp) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Loading DocMind AI...</span>
      </div>
    );
  }

  if (page === 'auth') {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex transition-colors duration-300">
      
      {/* 1. DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-72 bg-slate-900 dark:bg-slate-950 border-r border-slate-800 h-screen sticky top-0 text-slate-300 z-20 shrink-0">
        
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-white shadow-md shadow-indigo-600/30">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold font-display text-white leading-tight">DocMind AI</h1>
              <span className="text-[10px] font-mono text-indigo-400 font-bold tracking-widest uppercase">Universal RAG Engine</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="p-3.5 space-y-1 border-b border-slate-800">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 mb-1.5">Workspace</p>
          
          <button
            onClick={() => setActiveTab('chat')}
            className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all ${
              activeTab === 'chat'
                ? 'bg-indigo-600 text-white shadow font-semibold'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span>Chat Playground</span>
          </button>

          <button
            onClick={() => setActiveTab('search')}
            className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all ${
              activeTab === 'search'
                ? 'bg-indigo-600 text-white shadow font-semibold'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <Search className="h-4 w-4" />
            <span>Document Search</span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all ${
              activeTab === 'upload'
                ? 'bg-indigo-600 text-white shadow font-semibold'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <UploadCloud className="h-4 w-4" />
            <span>Upload Documents</span>
          </button>

          <button
            onClick={() => setActiveTab('documents')}
            className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all ${
              activeTab === 'documents'
                ? 'bg-indigo-600 text-white shadow font-semibold'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Document Library</span>
            {documents.length > 0 && (
              <span className="ml-auto px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded text-[10px]">
                {documents.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all ${
              activeTab === 'settings'
                ? 'bg-indigo-600 text-white shadow font-semibold'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <SettingsIcon className="h-4 w-4" />
            <span>RAG Settings</span>
          </button>
        </nav>

        {/* Dynamic Conversations List */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Conversations ({chats.length})
              </span>
              <div className="flex items-center gap-1">
                {chats.length > 0 && (
                  <button
                    onClick={handleClearAllChats}
                    className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors text-[10px]"
                    title="Clear All Conversations"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={handleCreateNewChat}
                  className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 transition-colors"
                  title="New Conversation"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Conversation Search Bar */}
            {chats.length > 0 && (
              <div className="relative px-0.5">
                <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                  placeholder="Filter conversations..."
                  className="w-full pl-8 pr-7 py-1.5 bg-slate-950/70 border border-slate-800 focus:border-indigo-500 rounded-xl text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none transition-colors"
                />
                {chatSearchQuery && (
                  <button
                    onClick={() => setChatSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-500 hover:text-slate-300 rounded transition-colors"
                    title="Clear search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
            
            <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
              {chats.length === 0 ? (
                <div className="text-xs text-slate-500 px-2 py-3 text-center border border-dashed border-slate-800 rounded-xl">
                  No conversations yet.
                </div>
              ) : filteredChats.length === 0 ? (
                <div className="text-xs text-slate-500 px-2 py-3.5 text-center border border-dashed border-slate-800 rounded-xl space-y-1.5">
                  <p className="text-[11px]">No conversations match "{chatSearchQuery}"</p>
                  <button
                    onClick={() => setChatSearchQuery('')}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium hover:underline"
                  >
                    Clear filter
                  </button>
                </div>
              ) : (
                filteredChats.map(chat => (
                  <div
                    key={chat.id}
                    onClick={() => {
                      setActiveChatId(chat.id);
                      setActiveTab('chat');
                    }}
                    className={`group px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between cursor-pointer transition-all ${
                      activeChatId === chat.id
                        ? 'bg-slate-800 text-white border border-slate-700 font-bold'
                        : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                    }`}
                  >
                    <span className="truncate flex-1 pr-2">{chat.title}</span>
                    <button
                      onClick={(e) => handleDeleteChat(chat.id, e)}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                      title="Delete conversation"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer User Info */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-full bg-indigo-900/60 text-indigo-300 flex items-center justify-center font-bold text-xs uppercase border border-indigo-700/50">
              {user?.fullName?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </div>
            <div className="truncate">
              <span className="block text-slate-200 font-bold truncate max-w-[110px]">{user?.fullName || 'User'}</span>
              <span className="block text-[10px] text-slate-500 truncate max-w-[110px]">{user?.email}</span>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

      </aside>

      {/* 2. MAIN WORKSPACE CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-screen">
        
        {/* Top Navbar */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 flex items-center justify-between shrink-0">
          
          <div className="flex items-center gap-3">
            {/* Mobile Menu Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Breadcrumb Title */}
            <div>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block leading-none">
                Workspace
              </span>
              <span className="text-base font-bold text-slate-900 dark:text-white capitalize">
                {activeTab === 'chat' && 'Precision RAG Chat'}
                {activeTab === 'search' && 'Document Content Search'}
                {activeTab === 'upload' && 'Upload Any Document'}
                {activeTab === 'documents' && 'Document Vector Library'}
                {activeTab === 'settings' && 'RAG Architecture Configuration'}
              </span>
            </div>
          </div>

          {/* Top Right Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Upload Button */}
            <button
              onClick={() => setActiveTab('upload')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-semibold transition-colors border border-indigo-100 dark:border-indigo-900"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              <span>Upload Document</span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              title="Toggle Light/Dark Theme"
            >
              {settings.theme === 'dark' ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex md:hidden">
            <div className="w-4/5 max-w-xs bg-slate-900 text-slate-200 h-full p-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white text-xs">
                      D
                    </div>
                    <span className="font-bold font-display text-white text-sm">DocMind AI</span>
                  </div>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-slate-400">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <nav className="space-y-1">
                  {[
                    { id: 'chat', label: 'Chat Playground', icon: MessageSquare },
                    { id: 'search', label: 'Document Search', icon: Search },
                    { id: 'upload', label: 'Upload Documents', icon: UploadCloud },
                    { id: 'documents', label: 'Document Library', icon: Layers },
                    { id: 'settings', label: 'RAG Settings', icon: SettingsIcon },
                  ].map(tab => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id as any);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 ${
                          activeTab === tab.id ? 'bg-indigo-600 text-white' : 'text-slate-400'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </nav>

                {/* Mobile Conversations Section */}
                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Conversations ({chats.length})
                    </span>
                    <button
                      onClick={() => {
                        handleCreateNewChat();
                        setMobileMenuOpen(false);
                      }}
                      className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 text-xs flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      <span className="text-[10px]">New</span>
                    </button>
                  </div>

                  {chats.length > 0 && (
                    <div className="relative">
                      <Search className="h-3 w-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      <input
                        type="text"
                        value={chatSearchQuery}
                        onChange={(e) => setChatSearchQuery(e.target.value)}
                        placeholder="Search chats..."
                        className="w-full pl-7 pr-6 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                      {chatSearchQuery && (
                        <button
                          onClick={() => setChatSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1">
                    {filteredChats.map(chat => (
                      <div
                        key={chat.id}
                        onClick={() => {
                          setActiveChatId(chat.id);
                          setActiveTab('chat');
                          setMobileMenuOpen(false);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs truncate cursor-pointer ${
                          activeChatId === chat.id
                            ? 'bg-slate-800 text-white font-bold'
                            : 'text-slate-400 hover:bg-slate-800/50'
                        }`}
                      >
                        {chat.title}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 truncate max-w-[150px]">{user?.email}</span>
                <button onClick={handleSignOut} className="p-1.5 text-rose-400">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          
          {/* 1. Chat Tab */}
          {activeTab === 'chat' && (
            <ChatTab
              activeChatId={activeChatId}
              settings={settings}
              chats={chats}
              documents={documents}
              onSendMessage={handleSendMessage}
              onSelectChat={(id) => setActiveChatId(id)}
              onCreateNewChat={handleCreateNewChat}
              onDeleteChat={handleDeleteChat}
              onClearChatMessages={handleClearChatMessages}
              loadingMessage={loadingMessage}
            />
          )}

          {/* 2. Search Tab */}
          {activeTab === 'search' && (
            <SearchTab
              documents={documents}
              onAskInChat={handleAskInChat}
            />
          )}

          {/* 3. Upload Tab */}
          {activeTab === 'upload' && (
            <UploadTab
              settings={settings}
              onUploadSuccess={refreshData}
              onOpenChat={() => setActiveTab('chat')}
              onOpenSearch={() => setActiveTab('search')}
            />
          )}

          {/* 4. Document Library Tab */}
          {activeTab === 'documents' && (
            <DocumentsTab
              documents={documents}
              onDeleteDocument={handleDeleteDocument}
              onClearAllDocuments={handleClearAllDocuments}
              onOpenSearchForDoc={(docId) => {
                setActiveTab('search');
              }}
              onOpenChatWithPrompt={handleAskInChat}
            />
          )}

          {/* 5. Settings Tab */}
          {activeTab === 'settings' && (
            <SettingsTab
              settings={settings}
              onSettingsChange={handleSettingsChange}
            />
          )}

        </main>
      </div>

    </div>
  );
}
