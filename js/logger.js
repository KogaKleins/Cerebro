/**
 * 📋 LOGGER MODULE
 * Sistema de logging condicional para desenvolvimento e produção
 * 
 * Features:
 * - Logs apenas em modo debug
 * - Formatação consistente
 * - Níveis de log (debug, info, warn, error)
 * - Controle via localStorage
 */

export const Logger = {
    /**
     * Verifica se o modo debug está ativo
     */
    get isDebugMode() {
        // Debug mode pode ser ativado via localStorage
        return localStorage.getItem('cerebroDebugMode') === 'true' || 
               window.location.hostname === 'localhost';
    },

    /**
     * Ativa modo debug
     */
    enableDebug() {
        localStorage.setItem('cerebroDebugMode', 'true');
        console.log('🐛 Modo debug ATIVADO');
    },

    /**
     * Desativa modo debug
     */
    disableDebug() {
        localStorage.setItem('cerebroDebugMode', 'false');
        console.log('🐛 Modo debug DESATIVADO');
    },

    /**
     * Log de debug (apenas em modo debug)
     */
    debug(...args) {
        if (this.isDebugMode) {
            console.log('🐛', ...args);
        }
    },

    /**
     * Log de informação (apenas em modo debug)
     */
    info(...args) {
        if (this.isDebugMode) {
            console.log('ℹ️', ...args);
        }
    },

    /**
     * Log de sucesso (apenas em modo debug)
     */
    success(...args) {
        if (this.isDebugMode) {
            console.log('✅', ...args);
        }
    },

    /**
     * Log de aviso (sempre exibe)
     */
    warn(...args) {
        console.warn('⚠️', ...args);
    },

    /**
     * Log de erro (sempre exibe)
     */
    error(...args) {
        console.error('❌', ...args);
    },

    /**
     * Agrupa logs relacionados
     */
    group(label, callback) {
        if (this.isDebugMode) {
            console.group(label);
            callback();
            console.groupEnd();
        }
    },

    /**
     * Mede tempo de execução
     */
    time(label) {
        if (this.isDebugMode) {
            console.time(label);
        }
    },

    timeEnd(label) {
        if (this.isDebugMode) {
            console.timeEnd(label);
        }
    },

    /**
     * Log de tabela (apenas em modo debug)
     */
    table(data) {
        if (this.isDebugMode) {
            console.table(data);
        }
    },

    /**
     * Log de estado da aplicação
     */
    state(moduleName, state) {
        if (this.isDebugMode) {
            console.group(`📊 Estado - ${moduleName}`);
            console.log(JSON.stringify(state, null, 2));
            console.groupEnd();
        }
    }
};

// Expor no window para console
window.Logger = Logger;

// Adicionar comandos de console
console.log('%c🧠 CÉREBRO - Sistema de Logs', 'font-size: 16px; font-weight: bold; color: #6F4E37');
console.log('%cComandos disponíveis:', 'font-weight: bold');
console.log('  Logger.enableDebug()  - Ativar modo debug');
console.log('  Logger.disableDebug() - Desativar modo debug');
console.log('  Logger.isDebugMode    - Verificar status');
console.log('');

if (Logger.isDebugMode) {
    console.log('%c🐛 Modo DEBUG está ATIVO', 'color: green; font-weight: bold');
} else {
    console.log('%c🔒 Modo DEBUG está DESATIVADO', 'color: gray');
    console.log('%cPara ativar: Logger.enableDebug()', 'color: gray; font-style: italic');
}
