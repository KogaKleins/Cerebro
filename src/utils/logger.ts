/**
 * 🧠 CÉREBRO - Logger
 * Sistema de logging estruturado com Winston
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';

// ============================================
// TRACE ID SUPPORT
// ============================================

// Storage para trace ID usando AsyncLocalStorage
const asyncLocalStorage = new AsyncLocalStorage<{ traceId: string }>();

/**
 * Obtém o trace ID atual
 * Retorna 'no-trace' se não houver trace ativo
 */
export function getTraceId(): string {
  return asyncLocalStorage.getStore()?.traceId || 'no-trace';
}

/**
 * Executa uma função com um trace ID
 */
export function withTraceId<T>(fn: () => T, traceId?: string): T {
  const id = traceId || uuidv4();
  return asyncLocalStorage.run({ traceId: id }, fn);
}

/**
 * Middleware para adicionar trace ID às requisições
 * O trace ID é propagado via header X-Trace-ID
 */
export function traceIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const traceId = (req.headers['x-trace-id'] as string) || uuidv4();
  res.setHeader('x-trace-id', traceId);
  
  asyncLocalStorage.run({ traceId }, () => {
    next();
  });
}

// ============================================
// FORMATOS DE LOG
// ============================================

// Formato customizado para logs com trace ID
const addTraceId = winston.format((info) => {
  info.traceId = getTraceId();
  return info;
});

// Formato customizado para logs
const logFormat = winston.format.combine(
  addTraceId(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label', 'traceId'] }),
  winston.format.json()
);

// Formato para console (desenvolvimento)
const consoleFormat = winston.format.combine(
  addTraceId(),
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf((info) => {
    const { timestamp, level, message, traceId, ...meta } = info;
    let metaString = '';
    if (Object.keys(meta).length > 0 && meta.metadata) {
      metaString = '\n' + JSON.stringify(meta.metadata, null, 2);
    }
    const traceStr = traceId as string;
    const traceInfo = traceStr && traceStr !== 'no-trace' ? ` [${traceStr.substring(0, 8)}]` : '';
    return `${timestamp} [${level}]${traceInfo}: ${message}${metaString}`;
  })
);

// Transport para arquivos com rotação diária
const fileRotateTransport = new DailyRotateFile({
  filename: path.join('logs', 'application-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: logFormat,
  level: 'info'
});

// Transport para erros
const errorFileTransport = new winston.transports.File({
  filename: path.join('logs', 'error.log'),
  level: 'error',
  format: logFormat,
  maxsize: 5242880, // 5MB
  maxFiles: 5
});

// Transport para todos os logs
const combinedFileTransport = new winston.transports.File({
  filename: path.join('logs', 'combined.log'),
  format: logFormat,
  maxsize: 5242880, // 5MB
  maxFiles: 5
});

// Transport para console (desenvolvimento)
const consoleTransport = new winston.transports.Console({
  format: consoleFormat,
  level: 'debug'
});

// Criar logger principal
export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'cerebro' },
  transports: [
    fileRotateTransport,
    errorFileTransport,
    combinedFileTransport,
    ...(process.env.NODE_ENV !== 'production' ? [consoleTransport] : [])
  ],
  exitOnError: false
});

// Capturar exceções não tratadas
logger.exceptions.handle(
  new winston.transports.File({ 
    filename: path.join('logs', 'exceptions.log')
  })
);

// Capturar rejeições não tratadas
logger.rejections.handle(
  new winston.transports.File({ 
    filename: path.join('logs', 'rejections.log')
  })
);

// Helper para log com contexto
export const logWithContext = (
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  context?: Record<string, any>
) => {
  logger.log(level, message, context);
};

// Helpers específicos
export const logRequest = (
  method: string,
  url: string,
  statusCode: number,
  duration: number,
  user?: string
) => {
  logger.info('HTTP Request', {
    method,
    url,
    statusCode,
    duration: `${duration}ms`,
    user: user || 'anonymous'
  });
};

export const logError = (
  error: Error,
  context?: Record<string, any>
) => {
  logger.error(error.message, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    ...context
  });
};

export const logWebSocket = (
  event: string,
  username: string,
  data?: any
) => {
  logger.debug('WebSocket Event', {
    event,
    username,
    data
  });
};

// Stream para Morgan (HTTP request logging)
export const morganStream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

export default logger;
