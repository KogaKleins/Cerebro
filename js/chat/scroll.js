/**
 * CHAT SCROLL MODULE
 * Gerenciamento de scroll e paginação
 */

export const ChatScroll = {
    /**
     * Força scroll para o final com múltiplas tentativas
     */
    forceScrollToBottom(isUserScrollingRef, scrollObserverRef) {
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;
        
        // Reset flag de scroll manual
        isUserScrollingRef.value = false;
        const observerRef = scrollObserverRef || { value: null };
        
        const doScroll = () => {
            if (chatContainer && chatContainer.scrollHeight > 0) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        };
        
        // Múltiplas tentativas em diferentes momentos
        doScroll();
        requestAnimationFrame(doScroll);
        setTimeout(doScroll, 50);
        setTimeout(doScroll, 150);
        setTimeout(doScroll, 300);
        setTimeout(doScroll, 500);
        
        // Observer para quando imagens/conteúdo carregarem
        if (!observerRef.value) {
            observerRef.value = new MutationObserver(() => {
                if (!isUserScrollingRef.value) {
                    doScroll();
                }
            });
        }
        
        observerRef.value.observe(chatContainer, { 
            childList: true, 
            subtree: true,
            attributes: true 
        });
        
        // Parar de observar após 2 segundos
        setTimeout(() => {
            if (observerRef.value) {
                observerRef.value.disconnect();
                observerRef.value = null;
            }
        }, 2000);
    },
    
    /**
     * Detecta se o usuário está rolando manualmente
     */
    setupScrollDetection(isUserScrollingRef, scrollTimeoutRef, showNewMessagesBtnCallback, hideNewMessagesBtnCallback) {
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;
        
        chatContainer.addEventListener('scroll', () => {
            // Detectar se está perto do final (dentro de 100px)
            const isNearBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 100;
            
            // Se não está perto do final, usuário está rolando
            isUserScrollingRef.value = !isNearBottom;
            
            // Esconder botão de novas mensagens se chegou ao final
            if (isNearBottom) {
                hideNewMessagesBtnCallback();
            }
            
            // Limpar timeout anterior
            if (scrollTimeoutRef.value) {
                clearTimeout(scrollTimeoutRef.value);
            }
            
            // Após 3 segundos sem scroll, considerar que parou
            scrollTimeoutRef.value = setTimeout(() => {
                // Só resetar se estiver perto do final
                if (isNearBottom) {
                    isUserScrollingRef.value = false;
                }
            }, 3000);
        });
    },
    
    /**
     * Mostra o botão de novas mensagens
     */
    showNewMessagesButton(scrollToBottomCallback) {
        let btn = document.getElementById('newMessagesBtn');
        const chatContainer = document.querySelector('.chat-container');
        
        if (!btn && chatContainer) {
            btn = document.createElement('button');
            btn.id = 'newMessagesBtn';
            btn.className = 'new-messages-btn';
            btn.innerHTML = '<i class="fas fa-arrow-down"></i> Novas mensagens';
            btn.addEventListener('click', () => {
                scrollToBottomCallback();
                this.hideNewMessagesButton();
            });
            chatContainer.appendChild(btn);
        }
        
        if (btn) {
            btn.classList.add('visible');
        }
    },
    
    /**
     * Esconde o botão de novas mensagens
     */
    hideNewMessagesButton() {
        const btn = document.getElementById('newMessagesBtn');
        if (btn) {
            btn.classList.remove('visible');
        }
    },
    
    /**
     * Rola suavemente para o final do chat
     */
    scrollToBottom(instant = false, isUserScrollingRef) {
        const chatContainer = document.getElementById('chatMessages');
        if (chatContainer) {
            isUserScrollingRef.value = false;
            
            if (instant) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            } else {
                chatContainer.scrollTo({
                    top: chatContainer.scrollHeight,
                    behavior: 'smooth'
                });
            }
            
            // Garantir que chegou ao final
            requestAnimationFrame(() => {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            });
        }
    }
};

