/**
 * 🧠 CÉREBRO - User Routes
 * Rotas de usuários (API v2)
 */

import { Router, Response, NextFunction } from 'express';
import { authenticateToken, requireAdmin } from '../utils/auth.utils';
import { logger } from '../utils/logger';
import { getRepositories } from '../repositories';
import { AuthRequest } from '../types';
import { NotFoundError } from '../utils/errors';

const router = Router();
const repos = getRepositories();

/**
 * GET /api/v2/users
 * Listar todos os usuários
 */
router.get('/', authenticateToken, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const users = await repos.user.findAll();
    // Não enviar senhas
    const usersWithoutPasswords = users.map(({ password, ...user }) => user);
    res.json(usersWithoutPasswords);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v2/users/:username
 * Buscar usuário por username
 */
router.get('/:username', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { username } = req.params;
    const user = await repos.user.findByUsername(username);
    
    if (!user) {
      throw new NotFoundError('Usuário');
    }
    
    // Não enviar senha
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v2/users/:username/audit
 * 🆕 Ver histórico de pontos de um usuário
 * CORREÇÃO #6: Auditoria transparente de todos os pontos do usuário
 */
router.get('/:username/audit', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { username } = req.params;
    
    // Validar: usuário pode ver seus próprios dados ou admin pode ver qualquer um
    if (req.user?.role !== 'ADMIN' && req.user?.username !== username) {
      return res.status(403).json({ error: 'Não autorizado a ver auditoria de outro usuário' });
    }

    const user = await repos.user.findByUsername(username);
    if (!user) {
      throw new NotFoundError('Usuário');
    }

    // Buscar audit logs
    const auditLogs = await repos.prisma.xPAuditLog.findMany({
      where: { userId: user.id },
      orderBy: { timestamp: 'desc' },
      take: 100
    });

    // Calcular estatísticas
    const stats = {
      totalTransactions: auditLogs.length,
      pending: auditLogs.filter(l => l.status === 'pending').length,
      confirmed: auditLogs.filter(l => l.status === 'confirmed').length,
      reversed: auditLogs.filter(l => l.status === 'reversed').length,
      totalXPConfirmed: auditLogs
        .filter(l => l.status === 'confirmed')
        .reduce((sum, l) => sum + l.amount, 0),
      bySource: {} as Record<string, number>
    };

    // Agrupar por fonte
    auditLogs.forEach(log => {
      stats.bySource[log.source] = (stats.bySource[log.source] || 0) + log.amount;
    });

    res.json({
      username,
      stats,
      recentLogs: auditLogs.map(l => ({
        id: l.id,
        amount: l.amount,
        reason: l.reason,
        source: l.source,
        status: l.status,
        timestamp: l.timestamp.toISOString(),
        balanceBefore: l.balanceBefore,
        balanceAfter: l.balanceAfter
      }))
    });

  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/all/data
 * Limpar todos os dados (APENAS ADMIN)
 */
router.delete('/all/data', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Deletar em ordem para respeitar as constraints de FK
    await repos.prisma.rating.deleteMany({});
    await repos.prisma.achievement.deleteMany({});
    await repos.prisma.message.deleteMany({});
    await repos.prisma.coffee.deleteMany({});
    
    logger.warn(`All data cleared by admin: ${req.user?.username}`);
    res.json({ success: true, message: 'Todos os dados foram limpos!' });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// 🆕 BAN SYSTEM ENDPOINTS
// ==========================================

/**
 * GET /api/v2/users/:username/ban-status
 * Verificar se um usuário está banido
 */
router.get('/:username/ban-status', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { username } = req.params;
    const banStatus = await repos.user.getBanStatus(username);
    
    if (!banStatus) {
      throw new NotFoundError('Usuário');
    }
    
    res.json(banStatus);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v2/users/:username/ban
 * Banir um usuário (auto-moderação ou admin)
 */
router.post('/:username/ban', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { username } = req.params;
    const { reason, durationMs } = req.body;
    
    // Usuário pode se auto-banir (moderação automática) ou admin pode banir qualquer um
    const isAutoModeration = req.user?.username === username;
    const isAdmin = req.user?.role === 'ADMIN';
    
    if (!isAutoModeration && !isAdmin) {
      return res.status(403).json({ error: 'Não autorizado' });
    }
    
    const user = await repos.user.banUser(username, reason || 'Violação das regras', durationMs || 3600000);
    
    if (!user) {
      throw new NotFoundError('Usuário');
    }
    
    logger.warn(`User banned: ${username} until ${user.bannedUntil} - Reason: ${reason} - By: ${req.user?.username}`);
    
    res.json({ 
      success: true, 
      banned: true,
      until: user.bannedUntil,
      reason: user.banReason
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v2/users/:username/ban
 * Remover ban de um usuário (ADMIN)
 */
router.delete('/:username/ban', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { username } = req.params;
    const user = await repos.user.unbanUser(username);
    
    if (!user) {
      throw new NotFoundError('Usuário');
    }
    
    logger.info(`User unbanned: ${username} by admin: ${req.user?.username}`);
    
    res.json({ success: true, banned: false });
  } catch (error) {
    next(error);
  }
});

export { router as userRoutes };
