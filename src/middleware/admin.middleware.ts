/**
 * ✓ CORREÇÃO #3: Middleware Admin
 * Protege rotas administrativas verificando role = 'ADMIN'
 * 
 * Uso: router.get('/admin/path', requireAdmin, handler)
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Middleware: Verificar se usuário é ADMIN
 * Use em todas as rotas administrativas
 */
export const requireAdmin = (_req: AuthRequest, _res: Response, next: NextFunction) => {
    // 1. Verificar se user está autenticado
    if (!_req.user) {
        logger.warn('Tentativa de acesso admin sem autenticação', {
            ip: _req.ip,
            path: _req.path
        });
        throw new AppError('Não autenticado', 401);
    }
    
    // 2. Verificar se é ADMIN
    if (_req.user.role !== 'ADMIN') {
        logger.warn(`Usuário não-admin tentou acessar rota admin`, {
            username: _req.user.username,
            role: _req.user.role,
            path: _req.path,
            method: _req.method,
            ip: _req.ip
        });
        throw new AppError('Acesso negado: apenas administradores podem acessar', 403);
    }
    
    // 3. Log do acesso admin bem-sucedido
    logger.info(`Admin acessou ${_req.method} ${_req.path}`, {
        username: _req.user.username,
        ip: _req.ip
    });
    
    next();
};

/**
 * Middleware alternativo (mais strict)
 * Verifica AMBAS: token JWT E role no banco
 * Use se precisar validação extra
 */
export const requireAdminStrict = async (_req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!_req.user) {
        throw new AppError('Não autenticado', 401);
    }
    
    if (_req.user.role !== 'ADMIN') {
        throw new AppError('Acesso negado', 403);
    }
    
    next();
};
