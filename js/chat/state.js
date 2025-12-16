/**
 * CHAT STATE MODULE
 * Gerencia todo o estado do chat (variáveis, constantes, flags)
 */

export const ChatState = {
    // Available reactions
    reactions: ['👍', '❤️', '😂', '😮', '😢', '☕', '🔥', '👀'],
    
    // Search
    searchQuery: '',
    
    // Messages
    lastMessageId: null,
    allMessages: [], // Todas as mensagens carregadas
    
    // Scroll
    isUserScrolling: false,
    scrollTimeout: null,
    
    // Typing
    typingTimeout: null,
    isTyping: false,
    
    // Unread
    unreadCount: 0,
    lastReadMessageId: null,
    
    // Online users
    onlineUsers: new Map(), // Map de username -> { lastSeen, isTyping, status }
    activityInterval: null,
    ONLINE_THRESHOLD: 5 * 60 * 1000, // 5 minutos para considerar online
    TYPING_TIMEOUT: 3000, // 3 segundos sem digitar = parou
    
    // Reply
    replyingTo: null, // Mensagem sendo respondida
    
    // Paginação de mensagens (estilo WhatsApp)
    PAGE_SIZE: 50, // Mensagens por página
    currentPage: 1,
    isLoadingMore: false,
    hasMoreMessages: true,
    
    // Sync
    lastSyncTimestamp: 0,
    lastServerDataHash: null, // Hash para detectar mudanças no servidor
    syncInProgress: false,
    
    // Scroll observer
    _scrollObserver: null
};


