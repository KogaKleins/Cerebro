/**
 * UTILITIES MODULE
 * Helper functions and utilities
 */

export const Utils = {
    /**
     * 🔧 Normaliza um nome/username para comparação consistente
     * Remove acentos, converte para minúsculas e remove espaços extras
     * @param {string} name - Nome a ser normalizado
     * @returns {string} Nome normalizado
     */
    normalizeName(name) {
        if (!name) return '';
        return name
            .toLowerCase()
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, ''); // Remove acentos
    },
    
    // Date formatting
    formatTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    },
    
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    },
    
    formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    // HTML escape
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    /**
     * Enhanced Toast notification
     * @param {string} message - Message to display
     * @param {string} type - 'success' | 'error' | 'info' | 'warning'
     * @param {string} title - Optional title
     * @param {number} duration - Duration in ms (default 4000)
     */
    showToast(message, type = 'success', title = null, duration = 4000) {
        const container = document.getElementById('toastContainer');
        if (!container) {
            // Fallback to old toast if container doesn't exist
            this._showLegacyToast(message);
            return;
        }
        
        const icons = {
            success: '<i class="fas fa-check"></i>',
            error: '<i class="fas fa-times"></i>',
            info: '<i class="fas fa-info"></i>',
            warning: '<i class="fas fa-exclamation"></i>'
        };
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-content">
                ${title ? `<div class="toast-title">${title}</div>` : ''}
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" aria-label="Fechar notificação">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Add close functionality
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this._removeToast(toast));
        
        container.appendChild(toast);
        
        // Auto remove
        setTimeout(() => this._removeToast(toast), duration);
    },
    
    _removeToast(toast) {
        if (!toast || toast.classList.contains('exiting')) return;
        toast.classList.add('exiting');
        setTimeout(() => toast.remove(), 300);
    },
    
    _showLegacyToast(message) {
        // Fallback for legacy toast
        const existingToasts = document.querySelectorAll('.toast-notification');
        existingToasts.forEach(toast => toast.remove());
        
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            font-weight: 500;
            z-index: 3000;
            animation: slideIn 0.3s ease;
            box-shadow: 0 10px 30px rgba(16, 185, 129, 0.4);
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },
    
    /**
     * Show confirmation modal
     * @param {Object} options - Configuration object
     * @param {string} options.title - Modal title
     * @param {string} options.message - Modal message
     * @param {string} options.type - 'warning' | 'danger'
     * @param {string} options.confirmText - Confirm button text
     * @param {string} options.cancelText - Cancel button text
     * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
     */
    confirm(options = {}) {
        return new Promise((resolve) => {
            const {
                title = 'Confirmar ação',
                message = 'Você tem certeza que deseja continuar?',
                type = 'warning',
                confirmText = 'Confirmar',
                cancelText = 'Cancelar'
            } = options;
            
            const icons = {
                warning: '<i class="fas fa-exclamation-triangle"></i>',
                danger: '<i class="fas fa-trash-alt"></i>'
            };
            
            // Create modal
            const modal = document.createElement('div');
            modal.className = 'confirm-modal';
            modal.innerHTML = `
                <div class="confirm-modal-content">
                    <div class="confirm-modal-icon ${type}">
                        ${icons[type] || icons.warning}
                    </div>
                    <h3 class="confirm-modal-title">${title}</h3>
                    <p class="confirm-modal-message">${message}</p>
                    <div class="confirm-modal-actions">
                        <button class="btn-secondary cancel-btn">${cancelText}</button>
                        <button class="${type === 'danger' ? 'btn-danger' : 'btn-primary'} confirm-btn">${confirmText}</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Activate with slight delay for animation
            requestAnimationFrame(() => {
                modal.classList.add('active');
            });
            
            // Handle actions
            const confirmBtn = modal.querySelector('.confirm-btn');
            const cancelBtn = modal.querySelector('.cancel-btn');
            
            const cleanup = () => {
                modal.classList.remove('active');
                setTimeout(() => modal.remove(), 300);
            };
            
            confirmBtn.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });
            
            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });
            
            // Close on overlay click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    cleanup();
                    resolve(false);
                }
            });
            
            // Close on Escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(false);
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);
        });
    },
    
    /**
     * Add loading state to element
     * @param {HTMLElement} element 
     */
    setLoading(element, loading = true) {
        if (loading) {
            element.classList.add('btn-loading');
            element.disabled = true;
            // Wrap text in span if not already
            if (!element.querySelector('.btn-text')) {
                const text = element.innerHTML;
                element.innerHTML = `<span class="btn-text">${text}</span>`;
            }
        } else {
            element.classList.remove('btn-loading');
            element.disabled = false;
        }
    },
    
    /**
     * Debounce function
     * @param {Function} func 
     * @param {number} wait 
     */
    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    /**
     * Throttle function
     * @param {Function} func 
     * @param {number} limit 
     */
    throttle(func, limit = 300) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    /**
     * Show skeleton loading in element
     * @param {HTMLElement} container 
     * @param {number} count 
     */
    showSkeleton(container, count = 3) {
        container.innerHTML = Array(count).fill().map(() => `
            <div class="skeleton skeleton-card" style="height: 60px; margin-bottom: 10px;"></div>
        `).join('');
    },
    
    /**
     * Show confetti animation
     * @param {number} count 
     */
    showConfetti(count = 50) {
        const colors = ['#6F4E37', '#8D6E63', '#D7CCC8', '#FFF8F0', '#10b981', '#f59e0b'];
        
        for (let i = 0; i < count; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.cssText = `
                left: ${Math.random() * 100}vw;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                animation-delay: ${Math.random() * 2}s;
                animation-duration: ${2 + Math.random() * 2}s;
            `;
            document.body.appendChild(confetti);
            
            setTimeout(() => confetti.remove(), 5000);
        }
    },
    
    /**
     * Play haptic feedback (vibration) on mobile
     * @param {number} duration 
     */
    haptic(duration = 50) {
        if ('vibrate' in navigator) {
            navigator.vibrate(duration);
        }
    },
    
    /**
     * Copy text to clipboard
     * @param {string} text 
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('Copiado!', 'success');
            return true;
        } catch (err) {
            this.showToast('Erro ao copiar', 'error');
            return false;
        }
    }
};
