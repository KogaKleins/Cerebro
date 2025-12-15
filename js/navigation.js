/**
 * NAVIGATION MODULE
 * Handles page navigation and sidebar functionality
 */

export const Navigation = {
    init() {
        this.setupNavigation();
        this.setupMobileMenu();
    },
    
    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                // Remove active from all
                navItems.forEach(i => i.classList.remove('active'));
                // Add active to clicked
                item.classList.add('active');
                
                // Show corresponding page
                const pageId = item.dataset.page;
                this.showPage(pageId);
                
                // Close mobile menu after navigation
                this.closeMobileMenu();
            });
        });
    },
    
    setupMobileMenu() {
        const toggle = document.getElementById('mobileMenuToggle');
        const overlay = document.getElementById('mobileOverlay');
        const sidebar = document.getElementById('sidebar');
        
        if (!toggle || !overlay || !sidebar) return;
        
        // Toggle button click
        toggle.addEventListener('click', () => {
            this.toggleMobileMenu();
        });
        
        // Close on overlay click
        overlay.addEventListener('click', () => {
            this.closeMobileMenu();
        });
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && sidebar.classList.contains('mobile-open')) {
                this.closeMobileMenu();
            }
        });
        
        // Handle resize - close mobile menu if screen gets larger
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                this.closeMobileMenu();
            }
        });
    },
    
    toggleMobileMenu() {
        const toggle = document.getElementById('mobileMenuToggle');
        const overlay = document.getElementById('mobileOverlay');
        const sidebar = document.getElementById('sidebar');
        
        const isOpen = sidebar.classList.contains('mobile-open');
        
        if (isOpen) {
            this.closeMobileMenu();
        } else {
            sidebar.classList.add('mobile-open');
            overlay.classList.add('active');
            toggle.classList.add('active');
            toggle.setAttribute('aria-expanded', 'true');
            toggle.setAttribute('aria-label', 'Fechar menu de navegação');
            document.body.style.overflow = 'hidden'; // Prevent scroll
        }
    },
    
    closeMobileMenu() {
        const toggle = document.getElementById('mobileMenuToggle');
        const overlay = document.getElementById('mobileOverlay');
        const sidebar = document.getElementById('sidebar');
        
        if (!toggle || !overlay || !sidebar) return;
        
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('active');
        toggle.classList.remove('active');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Abrir menu de navegação');
        document.body.style.overflow = ''; // Restore scroll
    },
    
    showPage(pageId) {
        const pages = document.querySelectorAll('.page');
        pages.forEach(page => page.classList.remove('active'));
        
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
            
            // Scroll to top smoothly
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            // Atualizar páginas específicas ao navegar
            if (pageId === 'levels') {
                this.updateLevelsPage();
            }
            
            // Chat: garantir scroll para o final
            if (pageId === 'chat') {
                this.scrollChatToBottom();
            }
        }
    },
    
    /**
     * Scroll do chat para o final - chamado ao navegar para o chat
     */
    scrollChatToBottom() {
        // Usar setTimeout para garantir que o DOM está pronto
        setTimeout(() => {
            if (window.Chat && typeof window.Chat.forceScrollToBottom === 'function') {
                window.Chat.forceScrollToBottom();
            } else {
                // Fallback direto
                const chatContainer = document.getElementById('chatMessages');
                if (chatContainer) {
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
            }
        }, 100);
        
        // Segunda tentativa após mais tempo
        setTimeout(() => {
            const chatContainer = document.getElementById('chatMessages');
            if (chatContainer) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        }, 300);
    },
    
    /**
     * Atualiza a página de níveis quando acessada
     */
    async updateLevelsPage() {
        try {
            const { Levels } = await import('./levels/index.js');
            if (Levels.initialized) {
                Levels.updateDisplay();
            }
        } catch (error) {
            console.warn('Erro ao atualizar página de níveis:', error);
        }
    }
};
