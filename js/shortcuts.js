/**
 * KEYBOARD SHORTCUTS MODULE
 * Global keyboard shortcuts for the application
 */

import { Utils } from './utils.js';

export const Shortcuts = {
    shortcuts: {
        // Navigation
        'Alt+1': { action: 'navigate', page: 'home', description: 'Ir para Início' },
        'Alt+2': { action: 'navigate', page: 'coffee', description: 'Ir para Café' },
        'Alt+3': { action: 'navigate', page: 'chat', description: 'Ir para Chat' },
        'Alt+4': { action: 'navigate', page: 'team', description: 'Ir para Equipe' },
        'Alt+5': { action: 'navigate', page: 'stats', description: 'Ir para Estatísticas' },
        
        // Actions
        'Alt+N': { action: 'newCoffee', description: 'Registrar café feito' },
        'Alt+B': { action: 'broughtCoffee', description: 'Registrar café trazido' },
        'Alt+S': { action: 'lottery', description: 'Sortear quem faz café' },
        'Alt+T': { action: 'toggleTheme', description: 'Alternar tema claro/escuro' },
        'Alt+P': { action: 'preferences', description: 'Minhas preferências' },
        
        // Chat
        'Ctrl+Enter': { action: 'sendMessage', description: 'Enviar mensagem (no chat)' },
        
        // General
        'Escape': { action: 'closeModal', description: 'Fechar modal' },
        'Alt+H': { action: 'showHelp', description: 'Mostrar atalhos' }
    },
    
    callbacks: {},
    enabled: true,
    
    init() {
        this.setupListeners();
        console.log('⌨️ Atalhos de teclado ativados');
    },
    
    setupListeners() {
        document.addEventListener('keydown', (e) => {
            if (!this.enabled) return;
            
            // Don't trigger shortcuts when typing in inputs
            if (this.isTyping(e)) {
                // Exception: Ctrl+Enter in chat input
                if (e.ctrlKey && e.key === 'Enter') {
                    const shortcut = this.shortcuts['Ctrl+Enter'];
                    if (shortcut && this.callbacks[shortcut.action]) {
                        e.preventDefault();
                        this.callbacks[shortcut.action]();
                    }
                }
                // Exception: Escape to blur input
                if (e.key === 'Escape') {
                    e.target.blur();
                }
                return;
            }
            
            const key = this.getKeyCombo(e);
            const shortcut = this.shortcuts[key];
            
            if (shortcut && this.callbacks[shortcut.action]) {
                e.preventDefault();
                this.callbacks[shortcut.action](shortcut);
                
                // Show feedback
                this.showFeedback(shortcut.description);
            }
        });
    },
    
    isTyping(e) {
        const target = e.target;
        const tagName = target.tagName.toLowerCase();
        return tagName === 'input' || tagName === 'textarea' || target.isContentEditable;
    },
    
    getKeyCombo(e) {
        const parts = [];
        if (e.ctrlKey) parts.push('Ctrl');
        if (e.altKey) parts.push('Alt');
        if (e.shiftKey) parts.push('Shift');
        
        let key = e.key;
        if (key === ' ') key = 'Space';
        if (key.length === 1) key = key.toUpperCase();
        
        parts.push(key);
        return parts.join('+');
    },
    
    register(action, callback) {
        this.callbacks[action] = callback;
    },
    
    unregister(action) {
        delete this.callbacks[action];
    },
    
    enable() {
        this.enabled = true;
    },
    
    disable() {
        this.enabled = false;
    },
    
    showFeedback(text) {
        // Show subtle feedback that shortcut was triggered
        const existing = document.querySelector('.shortcut-feedback');
        if (existing) existing.remove();
        
        const feedback = document.createElement('div');
        feedback.className = 'shortcut-feedback';
        feedback.textContent = text;
        document.body.appendChild(feedback);
        
        setTimeout(() => feedback.remove(), 1500);
    },
    
    showHelp() {
        const modal = document.getElementById('shortcutsModal');
        if (modal) {
            // Update shortcuts list
            const list = document.getElementById('shortcutsList');
            if (list) {
                const categories = {
                    'Navegação': [],
                    'Ações': [],
                    'Chat': [],
                    'Geral': []
                };
                
                for (const [key, shortcut] of Object.entries(this.shortcuts)) {
                    if (shortcut.action.startsWith('navigate')) {
                        categories['Navegação'].push({ key, ...shortcut });
                    } else if (['sendMessage'].includes(shortcut.action)) {
                        categories['Chat'].push({ key, ...shortcut });
                    } else if (['closeModal', 'showHelp'].includes(shortcut.action)) {
                        categories['Geral'].push({ key, ...shortcut });
                    } else {
                        categories['Ações'].push({ key, ...shortcut });
                    }
                }
                
                list.innerHTML = Object.entries(categories).map(([category, shortcuts]) => `
                    <div class="shortcuts-category">
                        <h4>${category}</h4>
                        ${shortcuts.map(s => `
                            <div class="shortcut-item">
                                <kbd>${s.key}</kbd>
                                <span>${s.description}</span>
                            </div>
                        `).join('')}
                    </div>
                `).join('');
            }
            
            modal.classList.add('active');
        }
    },
    
    closeHelp() {
        const modal = document.getElementById('shortcutsModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }
};

// Add styles dynamically
const style = document.createElement('style');
style.textContent = `
    .shortcut-feedback {
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--glass-bg-solid);
        color: var(--text-primary);
        padding: 10px 20px;
        border-radius: var(--radius-md);
        font-size: 0.9rem;
        box-shadow: var(--shadow-lg);
        animation: feedbackPop 0.3s ease;
        z-index: 10000;
        backdrop-filter: blur(10px);
        border: 1px solid var(--glass-border);
    }
    
    @keyframes feedbackPop {
        0% { transform: translateX(-50%) translateY(20px); opacity: 0; }
        100% { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
    
    .shortcuts-category {
        margin-bottom: var(--spacing-md);
    }
    
    .shortcuts-category h4 {
        color: var(--primary-coffee);
        margin-bottom: 10px;
        font-size: 0.9rem;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    
    .shortcut-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid var(--glass-border);
    }
    
    .shortcut-item:last-child {
        border-bottom: none;
    }
    
    kbd {
        background: var(--glass-bg);
        border: 1px solid var(--glass-border);
        border-radius: 4px;
        padding: 4px 8px;
        font-family: monospace;
        font-size: 0.85rem;
        color: var(--text-primary);
        box-shadow: 0 2px 0 var(--glass-shadow);
    }
    
    .shortcut-item span {
        color: var(--text-secondary);
        font-size: 0.9rem;
    }
`;
document.head.appendChild(style);
