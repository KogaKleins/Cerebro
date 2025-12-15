/**
 * 🆕 Daily Login Repository - Persiste logins diários no banco
 * 
 * TODOS os logins diários são salvos aqui para:
 * 1. Calcular XP de login diário
 * 2. Rastrear streaks corretamente (APENAS DIAS ÚTEIS)
 * 3. Permitir recálculo de XP sem perder dados
 * 
 * 🔧 CORREÇÃO: Streaks agora ignoram finais de semana!
 * - Sexta-feira -> Segunda-feira = 1 dia consecutivo (não quebra streak)
 * - Faltou segunda = quebra streak
 */

import { PrismaClient, DailyLogin } from '@prisma/client';
import { logger } from '../utils/logger';

/**
 * Verifica se uma data é dia útil (segunda a sexta)
 */
function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6; // 0 = domingo, 6 = sábado
}

/**
 * Retorna o próximo dia útil anterior a uma data
 * Usado para calcular streaks ignorando finais de semana
 */
function getPreviousWorkday(date: Date): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - 1);
  
  // Pular finais de semana
  while (!isWeekday(result)) {
    result.setDate(result.getDate() - 1);
  }
  
  return result;
}

/**
 * Retorna o último dia útil (hoje se for dia útil, ou sexta anterior)
 */
function getLastWorkday(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  
  // Se hoje é final de semana, voltar para sexta
  while (!isWeekday(result)) {
    result.setDate(result.getDate() - 1);
  }
  
  return result;
}



export class DailyLoginRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Registrar login diário (idempotente - um por dia)
   * Retorna se foi criado (primeiro login do dia) ou já existia
   */
  async recordLogin(userId: string, xpAwarded: number = 0): Promise<{ login: DailyLogin; created: boolean }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Tentar criar, se já existir retorna o existente
    const existing = await this.prisma.dailyLogin.findUnique({
      where: {
        userId_date: {
          userId,
          date: today
        }
      }
    });

    if (existing) {
      return { login: existing, created: false };
    }

    const login = await this.prisma.dailyLogin.create({
      data: {
        userId,
        date: today,
        xpAwarded
      }
    });

    return { login, created: true };
  }

  /**
   * Verificar se usuário já fez login hoje
   */
  async hasLoggedInToday(userId: string): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await this.prisma.dailyLogin.count({
      where: {
        userId,
        date: today
      }
    });

    return count > 0;
  }

  /**
   * Buscar último login de um usuário
   */
  async getLastLogin(userId: string): Promise<DailyLogin | null> {
    return this.prisma.dailyLogin.findFirst({
      where: { userId },
      orderBy: { date: 'desc' }
    });
  }

  /**
   * 🔧 CORRIGIDO: Calcular streak atual de um usuário
   * 
   * REGRA IMPORTANTE: Finais de semana NÃO quebram a streak!
   * - Se hoje é segunda e o usuário logou sexta, a streak continua
   * - Se hoje é segunda e o usuário NÃO logou sexta, a streak quebra
   * - Sábado e domingo são ignorados completamente
   */
  async calculateStreak(userId: string): Promise<number> {
    try {
      // Buscar todos os logins do usuário ordenados por data
      const logins = await this.prisma.dailyLogin.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 365 // Último ano
      });

      if (logins.length === 0) return 0;

      // Criar um Set de datas de login (apenas dias úteis)
      const loginDates = new Set<string>();
      for (const login of logins) {
        const date = new Date(login.date);
        date.setHours(0, 0, 0, 0);
        
        // Só contar dias úteis
        if (isWeekday(date)) {
          loginDates.add(date.toISOString().split('T')[0]);
        }
      }

      if (loginDates.size === 0) return 0;

      // Começar do último dia útil (hoje se for dia útil, ou sexta)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let currentDate = getLastWorkday(today);

      // Verificar se logou no último dia útil
      const lastWorkdayKey = currentDate.toISOString().split('T')[0];
      
      // Se hoje é dia útil e não logou hoje, verificar se logou no dia útil anterior
      if (isWeekday(today) && !loginDates.has(lastWorkdayKey)) {
        // Verificar se é início do dia (tolerância)
        const previousWorkday = getPreviousWorkday(currentDate);
        const prevKey = previousWorkday.toISOString().split('T')[0];
        
        if (!loginDates.has(prevKey)) {
          return 0; // Streak quebrada
        }
        
        // Começar do dia útil anterior
        currentDate = previousWorkday;
      }

      // Contar streak
      let streak = 0;
      
      while (true) {
        const dateKey = currentDate.toISOString().split('T')[0];
        
        if (loginDates.has(dateKey)) {
          streak++;
          currentDate = getPreviousWorkday(currentDate);
        } else {
          break;
        }
        
        // Limite de segurança
        if (streak > 500) break;
      }

      return streak;
    } catch (error) {
      logger.error('Erro ao calcular streak', { userId, error });
      return 0;
    }
  }

  /**
   * Contar total de logins de um usuário
   */
  async countTotalLogins(userId: string): Promise<number> {
    return this.prisma.dailyLogin.count({
      where: { userId }
    });
  }

  /**
   * Buscar histórico de logins de um usuário
   */
  async getLoginHistory(userId: string, limit: number = 30): Promise<DailyLogin[]> {
    return this.prisma.dailyLogin.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: limit
    });
  }

  /**
   * 🔧 CORRIGIDO: Verificar se usuário logou no último dia útil
   * Ignora finais de semana
   */
  async loggedLastWorkday(userId: string): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastWorkday = getPreviousWorkday(today);
    lastWorkday.setHours(0, 0, 0, 0);

    const count = await this.prisma.dailyLogin.count({
      where: {
        userId,
        date: lastWorkday
      }
    });

    return count > 0;
  }

  /**
   * @deprecated Use loggedLastWorkday instead
   * Mantido para compatibilidade
   */
  async loggedYesterday(userId: string): Promise<boolean> {
    return this.loggedLastWorkday(userId);
  }

  /**
   * 🔧 CORRIGIDO: Buscar melhor streak de um usuário
   * Considera apenas dias úteis
   */
  async calculateBestStreak(userId: string): Promise<number> {
    try {
      const logins = await this.prisma.dailyLogin.findMany({
        where: { userId },
        orderBy: { date: 'asc' }
      });

      if (logins.length === 0) return 0;

      // Filtrar apenas dias úteis e ordenar
      const workdayLogins = logins
        .filter(login => {
          const date = new Date(login.date);
          return isWeekday(date);
        })
        .map(login => {
          const date = new Date(login.date);
          date.setHours(0, 0, 0, 0);
          return date;
        })
        .sort((a, b) => a.getTime() - b.getTime());

      if (workdayLogins.length === 0) return 0;

      let bestStreak = 1;
      let currentStreak = 1;

      for (let i = 1; i < workdayLogins.length; i++) {
        const prevDate = workdayLogins[i - 1];
        const currDate = workdayLogins[i];
        
        // Calcular o próximo dia útil esperado
        const expectedNextWorkday = new Date(prevDate);
        expectedNextWorkday.setDate(expectedNextWorkday.getDate() + 1);
        
        // Pular finais de semana
        while (!isWeekday(expectedNextWorkday)) {
          expectedNextWorkday.setDate(expectedNextWorkday.getDate() + 1);
        }
        
        // Verificar se é o dia útil consecutivo
        if (currDate.getTime() === expectedNextWorkday.getTime()) {
          currentStreak++;
          bestStreak = Math.max(bestStreak, currentStreak);
        } else {
          currentStreak = 1;
        }
      }

      return bestStreak;
    } catch (error) {
      logger.error('Erro ao calcular melhor streak', { userId, error });
      return 0;
    }
  }

  /**
   * Deletar todos os logins (Admin only)
   */
  async deleteAll(): Promise<{ count: number }> {
    return this.prisma.dailyLogin.deleteMany({});
  }
}
