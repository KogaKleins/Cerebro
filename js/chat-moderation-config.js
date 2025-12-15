/**
 * 🛡️ CONFIGURAÇÕES DE MODERAÇÃO DO CHAT
 * 
 * Este arquivo permite ajustar facilmente as regras de moderação
 * sem precisar editar o código principal.
 * 
 * Após alterar, recarregue a página para aplicar as mudanças.
 */

export const MODERATION_CONFIG = {
    // ============================================
    // DETECÇÃO DE MENSAGENS IDÊNTICAS
    // ============================================
    identical: {
        enabled: true,                  // Ativar esta verificação
        maxMessages: 3,                 // Máximo de mensagens idênticas permitidas
        timeWindow: 60000,              // Janela de tempo em ms (1 minuto)
        severity: 3,                    // Gravidade da violação (1-5)
        description: 'Mensagens idênticas repetidas'
    },
    
    // ============================================
    // DETECÇÃO DE FLOOD (MENSAGENS RÁPIDAS)
    // ============================================
    flood: {
        enabled: true,                  // Ativar esta verificação
        maxMessagesPerMinute: 10,       // Máximo de mensagens por minuto
        minInterval: 1000,              // Intervalo mínimo entre mensagens (ms)
        severity: 3,                    // Gravidade da violação (1-5)
        description: 'Flood detectado - muitas mensagens rápidas'
    },
    
    // ============================================
    // MENSAGENS CURTAS REPETIDAS
    // ============================================
    shortMessages: {
        enabled: true,                  // Ativar esta verificação
        maxConsecutive: 5,              // Máximo de mensagens curtas seguidas
        maxLength: 3,                   // Caracteres para considerar "curta"
        severity: 2,                    // Gravidade da violação (1-5)
        description: 'Muitas mensagens curtas seguidas'
    },
    
    // ============================================
    // MENSAGENS SIMILARES
    // ============================================
    similarity: {
        enabled: true,                  // Ativar esta verificação
        maxSimilar: 4,                  // Máximo de mensagens similares
        threshold: 0.8,                 // % de similaridade (0.0 - 1.0)
        severity: 2,                    // Gravidade da violação (1-5)
        description: 'Mensagens muito similares detectadas'
    },
    
    // ============================================
    // SISTEMA DE AVISOS
    // ============================================
    warnings: {
        enabled: true,                  // Ativar sistema de avisos
        threshold: 0.6,                 // % do limite para começar a avisar (0.0 - 1.0)
        duration: 3000,                 // Duração do aviso em ms (0 = permanente)
        showCount: true                 // Mostrar quantas tentativas restam
    },
    
    // ============================================
    // SISTEMA DE BLOQUEIO
    // ============================================
    blocking: {
        enabled: true,                  // Ativar bloqueios automáticos
        duration: 3600000,              // Duração do bloqueio em ms (1 hora)
        deleteMessages: true,           // Deletar mensagens do usuário bloqueado
        messagesToDelete: 10,           // Quantas mensagens deletar
        systemMessage: true,            // Enviar mensagem de sistema ao bloquear
        persistBlocks: true             // Salvar bloqueios no localStorage
    },
    
    // ============================================
    // LIMPEZA AUTOMÁTICA
    // ============================================
    cleanup: {
        enabled: true,                  // Ativar limpeza automática
        interval: 60000,                // Intervalo de limpeza em ms (1 minuto)
        historyMaxAge: 300000           // Idade máxima do histórico em ms (5 minutos)
    },
    
    // ============================================
    // INTERFACE DO USUÁRIO
    // ============================================
    ui: {
        showWarnings: true,             // Mostrar avisos visuais
        showBlockMessages: true,        // Mostrar mensagens de bloqueio
        animateMessages: true,          // Animar mensagens de moderação
        playSound: false,               // Tocar som ao avisar/bloquear
        position: 'top'                 // Posição das mensagens ('top' ou 'bottom')
    },
    
    // ============================================
    // MODO DEBUG
    // ============================================
    debug: {
        enabled: false,                 // Ativar logs de debug
        logChecks: false,               // Logar todas as verificações
        logBlocks: true,                // Logar bloqueios
        logWarnings: true               // Logar avisos
    },
    
    // ============================================
    // WHITELIST (USUÁRIOS ISENTOS)
    // ============================================
    whitelist: {
        enabled: false,                 // Ativar whitelist
        users: [                        // Lista de usuários isentos
            // 'admin',
            // 'moderador'
        ]
    }
};

// ============================================
// PRESETS PREDEFINIDOS
// ============================================

export const MODERATION_PRESETS = {
    // Configuração muito permissiva
    lenient: {
        identical: { maxMessages: 5, timeWindow: 90000 },
        flood: { maxMessagesPerMinute: 15, minInterval: 500 },
        shortMessages: { maxConsecutive: 8 },
        similarity: { maxSimilar: 6, threshold: 0.9 },
        blocking: { duration: 1800000 } // 30 minutos
    },
    
    // Configuração balanceada (padrão)
    balanced: {
        identical: { maxMessages: 3, timeWindow: 60000 },
        flood: { maxMessagesPerMinute: 10, minInterval: 1000 },
        shortMessages: { maxConsecutive: 5 },
        similarity: { maxSimilar: 4, threshold: 0.8 },
        blocking: { duration: 3600000 } // 1 hora
    },
    
    // Configuração rigorosa
    strict: {
        identical: { maxMessages: 2, timeWindow: 60000 },
        flood: { maxMessagesPerMinute: 5, minInterval: 2000 },
        shortMessages: { maxConsecutive: 3 },
        similarity: { maxSimilar: 3, threshold: 0.7 },
        blocking: { duration: 7200000 } // 2 horas
    },
    
    // Configuração muito rigorosa
    veryStrict: {
        identical: { maxMessages: 2, timeWindow: 120000 },
        flood: { maxMessagesPerMinute: 3, minInterval: 3000 },
        shortMessages: { maxConsecutive: 2 },
        similarity: { maxSimilar: 2, threshold: 0.6 },
        blocking: { duration: 14400000 } // 4 horas
    }
};

/**
 * Aplicar um preset de configuração
 * @param {string} presetName - Nome do preset ('lenient', 'balanced', 'strict', 'veryStrict')
 */
export function applyPreset(presetName) {
    const preset = MODERATION_PRESETS[presetName];
    if (!preset) {
        console.error(`Preset '${presetName}' não encontrado`);
        return;
    }
    
    Object.keys(preset).forEach(category => {
        if (MODERATION_CONFIG[category]) {
            Object.assign(MODERATION_CONFIG[category], preset[category]);
        }
    });
    
    console.log(`✅ Preset '${presetName}' aplicado com sucesso`);
}

/**
 * Resetar para configuração padrão (balanced)
 */
export function resetToDefault() {
    applyPreset('balanced');
}

/**
 * Validar configuração
 */
export function validateConfig() {
    const errors = [];
    
    if (MODERATION_CONFIG.warnings.threshold < 0 || MODERATION_CONFIG.warnings.threshold > 1) {
        errors.push('warnings.threshold deve estar entre 0 e 1');
    }
    
    if (MODERATION_CONFIG.similarity.threshold < 0 || MODERATION_CONFIG.similarity.threshold > 1) {
        errors.push('similarity.threshold deve estar entre 0 e 1');
    }
    
    if (MODERATION_CONFIG.blocking.duration < 60000) {
        errors.push('blocking.duration deve ser no mínimo 60000ms (1 minuto)');
    }
    
    if (errors.length > 0) {
        console.error('⚠️ Erros na configuração de moderação:');
        errors.forEach(err => console.error(`  - ${err}`));
        return false;
    }
    
    return true;
}

// Exportar como padrão
export default MODERATION_CONFIG;
