/**
 * 🔍 CÉREBRO - Sentry Error Tracking
 * Rastreamento e notificação de erros em produção
 */

import * as Sentry from '@sentry/node';
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

let sentryInitialized = false;

/**
 * Inicializa o Sentry para error tracking
 * Deve ser chamado antes de qualquer middleware Express
 */
export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    logger.warn('SENTRY_DSN não configurado - error tracking desabilitado');
    return;
  }
  
  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.npm_package_version || '2.0.0',
      
      // Taxa de amostragem para traces (performance)
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
      
      // Taxa de amostragem para erros (sempre capturar em prod)
      sampleRate: 1.0,
      
      // Filtrar erros não importantes
      beforeSend(event, hint) {
        const error = hint.originalException;
        
        // Ignorar erros 4xx (erros do cliente)
        if (error && typeof error === 'object' && 'statusCode' in error) {
          const statusCode = (error as { statusCode: number }).statusCode;
          if (statusCode >= 400 && statusCode < 500) {
            return null;
          }
        }
        
        // Ignorar erros de conexão fechada pelo cliente
        if (error instanceof Error) {
          if (error.message.includes('ECONNRESET') ||
              error.message.includes('EPIPE') ||
              error.message.includes('socket hang up')) {
            return null;
          }
        }
        
        return event;
      },
      
      // Integrations
      integrations: [
        Sentry.httpIntegration(),
      ],
    });
    
    sentryInitialized = true;
    logger.info('Sentry initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Sentry', { error });
  }
}

/**
 * Verifica se o Sentry foi inicializado
 */
export function isSentryInitialized(): boolean {
  return sentryInitialized;
}

/**
 * Captura erro manualmente no Sentry
 * Use para erros que são tratados mas devem ser rastreados
 */
export function captureError(error: Error, context?: Record<string, unknown>) {
  if (!sentryInitialized) {
    logger.error('Sentry not initialized, error not captured', { error: error.message });
    return;
  }
  
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Captura mensagem no Sentry
 * Use para eventos importantes que não são erros
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  if (!sentryInitialized) return;
  
  Sentry.captureMessage(message, level);
}

/**
 * Define contexto do usuário atual
 * Chame após autenticação bem sucedida
 */
export function setUserContext(user: { id: string; username: string; role?: string }) {
  if (!sentryInitialized) return;
  
  Sentry.setUser({
    id: user.id,
    username: user.username,
    role: user.role,
  });
}

/**
 * Limpa contexto do usuário
 * Chame no logout
 */
export function clearUserContext() {
  if (!sentryInitialized) return;
  
  Sentry.setUser(null);
}

/**
 * Adiciona breadcrumb para rastreamento
 * Breadcrumbs são eventos que levaram ao erro
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'info'
) {
  if (!sentryInitialized) return;
  
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level,
  });
}

/**
 * Middleware de request handler do Sentry
 * Deve ser o primeiro middleware
 */
export function sentryRequestHandler() {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!sentryInitialized) {
      return next();
    }
    // Na nova versão do Sentry SDK, o tracking é feito automaticamente
    // após a inicialização. Este middleware agora apenas adiciona contexto.
    Sentry.setContext('request', {
      url: req.url,
      method: req.method,
      headers: req.headers,
    });
    next();
  };
}

/**
 * Middleware de error handler do Sentry
 * Deve ser usado antes do error middleware principal
 */
export function sentryErrorHandler() {
  return (err: Error, _req: Request, _res: Response, next: NextFunction) => {
    if (!sentryInitialized) {
      return next(err);
    }
    // Captura o erro no Sentry
    Sentry.captureException(err);
    next(err);
  };
}

/**
 * Wrapper para capturar erros em funções async
 */
export function withSentry<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context?: Record<string, unknown>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof Error) {
        captureError(error, context);
      }
      throw error;
    }
  }) as T;
}
