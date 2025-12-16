/**
 * CHAT SEARCH MODULE
 * Sistema de busca de mensagens
 */

export const ChatSearch = {
    /**
     * Configurar busca
     */
    setupSearch(searchQueryRef, filterCallback) {
        const searchInput = document.getElementById('chatSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQueryRef.value = e.target.value.toLowerCase();
                filterCallback();
            });
        }
    },
    
    /**
     * Filtrar mensagens por busca
     */
    filterMessages(searchQuery) {
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;
        
        const messages = chatContainer.querySelectorAll('.message');
        
        messages.forEach(msg => {
            if (!searchQuery) {
                msg.style.display = '';
                msg.classList.remove('search-highlight');
                return;
            }
            
            const text = msg.textContent.toLowerCase();
            if (text.includes(searchQuery)) {
                msg.style.display = '';
                msg.classList.add('search-highlight');
            } else {
                msg.style.display = 'none';
                msg.classList.remove('search-highlight');
            }
        });
        
        // Show/hide no results message
        const visibleMessages = chatContainer.querySelectorAll('.message:not([style*="display: none"])');
        let noResultsEl = chatContainer.querySelector('.no-search-results');
        
        if (visibleMessages.length === 0 && searchQuery) {
            if (!noResultsEl) {
                noResultsEl = document.createElement('div');
                noResultsEl.className = 'no-search-results';
                noResultsEl.innerHTML = '<i class="fas fa-search"></i><p>Nenhuma mensagem encontrada</p>';
                chatContainer.appendChild(noResultsEl);
            }
        } else if (noResultsEl) {
            noResultsEl.remove();
        }
    },
    
    /**
     * Limpar busca
     */
    clearSearch(searchQueryRef, filterCallback) {
        const searchInput = document.getElementById('chatSearch');
        if (searchInput) {
            searchInput.value = '';
            searchQueryRef.value = '';
            filterCallback();
        }
    }
};


