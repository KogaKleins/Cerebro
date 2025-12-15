/**
 * USER MODULE
 * Handles user identification and username modal
 */

import { State } from './state.js';
import { Chat } from './chat.js';
import { Auth } from './auth.js';

export const User = {
    init() {
        // Com o sistema de login, o usuário já está autenticado
        const session = Auth.getCurrentUser();
        if (session) {
            // Definir o usuário no State usando USERNAME (não name)
            // 'username' é minúsculo e consistent com o banco de dados
            State.setUser(session.username);
        }
    },
    
    showUsernameModal() {
        // Não precisamos mais do modal de username
        // O login já cuida disso
        const modal = document.getElementById('usernameModal');
        if (modal) {
            modal.style.display = 'none';
        }
    },
    
    setUsername() {
        // Mantido para compatibilidade
        const usernameInput = document.getElementById('username');
        if (!usernameInput) return;
        
        const username = usernameInput.value.trim();
        
        if (username) {
            State.setUser(username);
            
            const modal = document.getElementById('usernameModal');
            if (modal) {
                modal.classList.remove('active');
            }
            
            // Add system message to chat
            Chat.addSystemMessage(`${username} entrou no Cérebro! 🧠`);
        }
    }
};

// Export function for global access
window.setUsername = () => User.setUsername();
