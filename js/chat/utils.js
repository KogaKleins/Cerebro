/**
 * CHAT UTILS MODULE
 * Funções utilitárias para o chat
 */

/**
 * Normalizar nome de usuário (remove acentos, lowercase)
 * TODOS os nomes devem ser normalizados da mesma forma
 */
export function normalizeUsername(username) {
    if (!username || typeof username !== 'string') return '';
    return username
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''); // Remove diacritical marks
}

/**
 * Formata data para separador
 */
export function formatDateSeparator(date) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (msgDay.getTime() === today.getTime()) {
        return 'Hoje';
    } else if (msgDay.getTime() === yesterday.getTime()) {
        return 'Ontem';
    } else {
        return date.toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });
    }
}

/**
 * Formata tempo decorrido
 */
export function formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'agora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}min`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
    
    // Importar Utils dinamicamente para evitar dependência circular
    return new Date(timestamp).toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

/**
 * Retorna o status do usuário baseado na última atividade
 */
export function getUserStatus(lastActivity, ONLINE_THRESHOLD) {
    const now = Date.now();
    const diff = now - lastActivity;
    
    if (diff < ONLINE_THRESHOLD) {
        return 'online';
    } else if (diff < ONLINE_THRESHOLD * 2) {
        return 'away';
    } else {
        return 'offline';
    }
}

/**
 * Retorna texto do status
 */
export function getStatusText(status) {
    switch (status) {
        case 'online': return 'Online agora';
        case 'away': return 'Ausente';
        default: return 'Offline';
    }
}

/**
 * Gera hash das mensagens para detectar mudanças
 */
export function generateMessagesHash(messages) {
    if (!messages || messages.length === 0) return 'empty';
    
    // Usar os últimos 20 IDs e timestamps para gerar hash
    const recent = messages.slice(-20);
    const hashInput = recent.map(m => `${m.id}:${m.timestamp}`).join('|');
    
    // Hash simples
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
        const char = hashInput.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    
    return `h${hash}_c${messages.length}`;
}


