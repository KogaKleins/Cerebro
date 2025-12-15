/**
 * 🧠 CÉREBRO - Auth Routes
 * Rotas de autenticação
 */

import { Router, Request, Response } from 'express';
import { 
  verifyPassword, 
  generateToken, 
  authenticateToken,
  loadUsersFromEnv 
} from '../utils/auth.utils';
import { logger } from '../utils/logger';
import { recordLogin, recordError } from '../utils/metrics';
import { setUserContext } from '../utils/sentry';
import { AuthRequest } from '../types';
import { getRepositories, getPrismaClient } from '../repositories';
import { getPointsEngine } from '../services/points-engine.service';

const router = Router();

// Lazy load de usuários - será carregado na primeira requisição
let USERS: ReturnType<typeof loadUsersFromEnv> | null = null;

function getUsers() {
  if (!USERS) {
    logger.info('Loading users from environment...');
    USERS = loadUsersFromEnv();
    logger.info(`Loaded users: ${Object.keys(USERS).join(', ')}`);
  }
  return USERS;
}

/**
 * POST /api/auth/login
 * Autenticação de usuário
 * 🛡️ Inclui validação de entrada e proteção contra timing attacks
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    
    // 🛡️ Validação de entrada robusta
    if (!username || !password) {
      recordLogin(false);
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }
    
    // 🛡️ Validar tipo e tamanho das entradas (previne DoS)
    if (typeof username !== 'string' || typeof password !== 'string') {
      recordLogin(false);
      return res.status(400).json({ error: 'Formato de dados inválido' });
    }
    
    if (username.length > 100 || password.length > 200) {
      recordLogin(false);
      return res.status(400).json({ error: 'Dados de entrada muito longos' });
    }
    
    // 🛡️ Sanitizar username (previne injection)
    const normalizedUsername = username.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
    
    // 🛡️ Verificar se username foi alterado pela sanitização
    if (normalizedUsername !== username.toLowerCase().trim()) {
      logger.warn(`Login attempt with invalid characters: ${username.substring(0, 20)}`);
      recordLogin(false);
      return res.status(400).json({ error: 'Caracteres inválidos no nome de usuário' });
    }
    
    const users = getUsers();
    const user = users[normalizedUsername];
    
    // 🛡️ TIMING ATTACK PROTECTION: Sempre verificar senha mesmo se usuário não existe
    // Isso evita que atacantes descubram quais usuários existem medindo tempo de resposta
    const dummyHash = '$2b$10$dummyhashforprotectionagainsttimingattacks';
    const hashToVerify = user?.password || dummyHash;
    const isValid = await verifyPassword(password, hashToVerify);
    
    if (!user) {
      logger.warn(`Login attempt for non-existent user: ${normalizedUsername}`);
      recordLogin(false);
      // 🛡️ Usar mesma mensagem para não revelar se usuário existe
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    
    if (!isValid) {
      logger.warn(`Failed login attempt for user: ${normalizedUsername}`);
      recordLogin(false);
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    
    const token = generateToken({
      username: normalizedUsername,
      name: user.name,
      role: user.role
    });
    
    // Registrar métricas e contexto do Sentry
    recordLogin(true);
    setUserContext({ id: normalizedUsername, username: normalizedUsername, role: user.role });
    
    logger.info(`User logged in successfully: ${normalizedUsername}`);

    // ========== 🆕 SISTEMA DE DAILY LOGIN E STREAK ==========
    // Registra login diário e dá XP se for o primeiro login do dia
    let dailyLoginInfo = { streak: 0, xpAwarded: 0, isFirstLoginToday: false };
    
    try {
      const repos = getRepositories();
      const prismaClient = getPrismaClient();
      const pointsEngine = getPointsEngine(prismaClient, logger);
      
      // Buscar usuário no banco para ter o ID
      const dbUser = await repos.user.findByUsername(normalizedUsername);
      
      if (dbUser) {
        // Registrar login diário (idempotente - um por dia)
        const { login, created } = await repos.dailyLogin.recordLogin(dbUser.id);
        
        if (created) {
          // É o primeiro login de hoje!
          dailyLoginInfo.isFirstLoginToday = true;
          
          // Calcular streak
          const streak = await repos.dailyLogin.calculateStreak(dbUser.id);
          dailyLoginInfo.streak = streak;
          
          // XP de login diário (10 XP)
          const dailyXP = 10;
          await pointsEngine.addPoints(dbUser.id, 'system-correction', {
            amount: dailyXP,
            reason: 'Login diário',
            sourceId: `daily-login-${login.id}`,
            metadata: { streak, date: login.date.toISOString() }
          });
          dailyLoginInfo.xpAwarded += dailyXP;
          
          // Bônus de streak (se tiver 2+ dias consecutivos)
          if (streak >= 2) {
            const streakBonus = Math.min(streak * 5, 100); // 5 XP por dia, máx 100
            await pointsEngine.addPoints(dbUser.id, 'system-correction', {
              amount: streakBonus,
              reason: `Bônus de sequência: ${streak} dias consecutivos`,
              sourceId: `streak-bonus-${login.id}`,
              metadata: { streak }
            });
            dailyLoginInfo.xpAwarded += streakBonus;
          }
          
          logger.info('Daily login registered with XP', {
            username: normalizedUsername,
            streak,
            xpAwarded: dailyLoginInfo.xpAwarded
          });
        } else {
          // Já logou hoje, buscar streak atual
          dailyLoginInfo.streak = await repos.dailyLogin.calculateStreak(dbUser.id);
        }
      }
    } catch (dailyLoginError) {
      // Não falhar o login se houver erro no daily-login
      logger.warn('Error registering daily login (non-blocking)', { error: dailyLoginError });
    }
    
    res.json({
      success: true,
      token,
      user: {
        username: normalizedUsername,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        setor: user.setor,
        photo: user.photo
      },
      dailyLogin: dailyLoginInfo  // 🆕 Info sobre login diário
    });
  } catch (error) {
    logger.error('Login error', error);
    recordLogin(false);
    recordError('login', 500);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

/**
 * GET /api/auth/verify
 * Verifica se o token é válido
 */
router.get('/verify', authenticateToken, (req: AuthRequest, res: Response) => {
  res.json({ valid: true, user: req.user });
});

export { router as authRoutes };
