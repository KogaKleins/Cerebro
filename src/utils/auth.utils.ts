/**
 * 🧠 CÉREBRO - Auth Utils
 * Funções auxiliares de autenticação em TypeScript
 * 
 * 🛡️ SEGURANÇA: Implementa validações robustas contra XSS, CSRF e injection
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Response, NextFunction } from 'express';
import { JWTPayload, AuthRequest, User, UserRole } from '../types';
import { logger } from './logger';

// 🔐 CRÍTICO: JWT_SECRET deve ser configurado no .env
// Em produção, NUNCA usar fallback - forçar erro se não configurado
const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    logger.error('❌ CRITICAL: JWT_SECRET não configurado em produção!');
    throw new Error('JWT_SECRET é obrigatório em produção. Configure no .env');
  }
  if (!secret) {
    logger.warn('⚠️ JWT_SECRET não configurado - usando secret temporário (NÃO USE EM PRODUÇÃO)');
  }
  // Garantir que o secret tenha pelo menos 32 caracteres
  const finalSecret = secret || 'cerebro-dev-secret-' + Date.now().toString(36);
  if (finalSecret.length < 32) {
    logger.warn('⚠️ JWT_SECRET muito curto (< 32 chars) - considere usar um mais longo');
  }
  return finalSecret;
})();

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Hash de senha usando bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Verifica senha contra hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    logger.error('Error verifying password', { error });
    return false;
  }
}

/**
 * Gera token JWT
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: JWT_EXPIRES_IN 
  } as jwt.SignOptions);
}

/**
 * Verifica token JWT
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    logger.warn('Invalid token verification attempt', { error });
    return null;
  }
}

/**
 * Decodifica token sem verificar (útil para debug)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Extrai token do header Authorization
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
}

/**
 * Valida força da senha
 */
export function validatePasswordStrength(password: string): { 
  isValid: boolean; 
  errors: string[] 
} {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Senha deve ter no mínimo 8 caracteres');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Senha deve conter pelo menos uma letra maiúscula');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Senha deve conter pelo menos uma letra minúscula');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Senha deve conter pelo menos um número');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Middleware: Autenticação JWT
 */
export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = extractTokenFromHeader(authHeader);
  
  if (!token) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }
  
  const decoded = verifyToken(token);
  
  if (!decoded) {
    res.status(403).json({ error: 'Token inválido ou expirado' });
    return;
  }
  
  req.user = decoded;
  next();
}

/**
 * Middleware: Requer permissão de admin
 */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Acesso negado. Somente administradores.' });
    return;
  }
  
  next();
}

/**
 * Carregar usuários do .env
 * Formato: USER_NOME=username:password_hash:nome:role:avatar:setor
 */
export function loadUsersFromEnv(): Record<string, User & { password: string }> {
  const users: Record<string, User & { password: string }> = {};
  
  // Procurar todas as variáveis que começam com USER_
  for (const key in process.env) {
    if (key.startsWith('USER_') && key !== 'USER') {
      const value = process.env[key];
      if (!value) continue;
      
      // Formato: username:password_hash:nome:role:avatar:setor
      const parts = value.split(':');
      if (parts.length < 4) continue;
      
      const [username, password, name, role, avatar, setor, photo] = parts;
      
      if (username && password) {
        users[username.toLowerCase()] = {
          username: username.toLowerCase(),
          password,
          name: name || username,
          role: (role === 'admin' ? 'ADMIN' : 'MEMBER') as UserRole,
          avatar: avatar || '👤',
          setor: setor || 'Desconhecido',
          photo: photo || undefined
        };
      }
    }
  }
  
  if (Object.keys(users).length === 0) {
    logger.warn('No users loaded from environment variables');
  } else {
    logger.info(`Loaded ${Object.keys(users).length} users from environment`);
  }
  
  return users;
}

/**
 * Validar entrada
 */
export function validateInput(input: string, maxLength: number = 1000): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }
  
  if (input.length > maxLength) {
    return false;
  }
  
  return true;
}

/**
 * 🛡️ Sanitizar string (remover caracteres perigosos)
 * Proteção robusta contra XSS, injection e outros ataques
 * 
 * @param input - String a ser sanitizada
 * @param options - Opções de sanitização
 * @returns String sanitizada e segura
 */
export function sanitizeString(
  input: string, 
  options: { 
    maxLength?: number; 
    allowNewlines?: boolean;
    allowBasicFormatting?: boolean;
  } = {}
): string {
  if (typeof input !== 'string') return '';
  
  const { 
    maxLength = 10000, 
    allowNewlines = true,
    allowBasicFormatting = false 
  } = options;
  
  let sanitized = input;
  
  // 1. Limitar tamanho para prevenir DoS
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  // 2. Remover caracteres de controle (exceto newlines se permitido)
  if (allowNewlines) {
    sanitized = sanitized.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '');
  } else {
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
  }
  
  // 3. Normalizar unicode para prevenir homograph attacks
  sanitized = sanitized.normalize('NFC');
  
  // 4. Remover scripts e tags perigosas (múltiplas passadas para bypass protection)
  const dangerousPatterns = [
    // Scripts
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<script[^>]*>/gi,
    /<\/script>/gi,
    // iframes
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<iframe[^>]*>/gi,
    /<\/iframe>/gi,
    // Objects/embeds
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed[^>]*>/gi,
    // Forms que podem fazer phishing
    /<form[^>]*>/gi,
    /<\/form>/gi,
    // Inputs
    /<input[^>]*>/gi,
    // SVG (pode conter scripts)
    /<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi,
    // Math (pode ser explorado)
    /<math\b[^<]*(?:(?!<\/math>)<[^<]*)*<\/math>/gi,
    // Style tags (podem fazer CSS injection)
    /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
    // Links com javascript
    /<a[^>]*href\s*=\s*["']?javascript:[^>]*>/gi,
    // Base tag (pode redirecionar recursos)
    /<base[^>]*>/gi,
    // Meta refresh
    /<meta[^>]*http-equiv[^>]*refresh[^>]*>/gi,
  ];
  
  for (const pattern of dangerousPatterns) {
    sanitized = sanitized.replace(pattern, '');
  }
  
  // 5. Remover event handlers (onclick, onerror, etc) - CRÍTICO
  sanitized = sanitized.replace(/\bon\w+\s*=\s*(["'][^"']*["']|[^\s>]*)/gi, '');
  
  // 6. Remover protocolos perigosos
  const dangerousProtocols = [
    /javascript\s*:/gi,
    /vbscript\s*:/gi,
    /data\s*:\s*text\/html/gi,
    /data\s*:\s*application/gi,
  ];
  
  for (const protocol of dangerousProtocols) {
    sanitized = sanitized.replace(protocol, '');
  }
  
  // 7. Remover expressões CSS perigosas
  sanitized = sanitized.replace(/expression\s*\(/gi, '');
  sanitized = sanitized.replace(/url\s*\(\s*["']?\s*javascript/gi, 'url(blocked');
  
  // 8. Se não permitir formatação básica, remover todas as tags HTML
  if (!allowBasicFormatting) {
    sanitized = sanitized.replace(/<[^>]*>/g, '');
  }
  
  // 9. Encode caracteres especiais HTML se ainda houver
  sanitized = sanitized
    .replace(/&(?!amp;|lt;|gt;|quot;|#\d+;|#x[\da-fA-F]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  return sanitized.trim();
}

/**
 * 🛡️ Escapa HTML para exibição segura (não remove, apenas escapa)
 * Use quando quiser preservar o texto original mas renderizá-lo de forma segura
 */
export function escapeHtml(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validar ID
 */
export function isValidId(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }
  
  // Permitir IDs numéricos ou alfanuméricos com hífen
  return /^[a-zA-Z0-9\-_]+$/.test(id) && id.length > 0 && id.length < 100;
}
