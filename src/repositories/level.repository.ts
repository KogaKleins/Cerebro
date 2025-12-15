/**
 * Repository para dados de níveis e XP dos usuários
 */

import { PrismaClient, UserLevel } from '@prisma/client';

export interface UserLevelData {
  xp: number;
  level: number;
  totalXP: number;
  streak: number;
  bestStreak: number;
  lastDaily: string | null;
  trackedActions: {
    ratings: string[];
    reactions: string[];
    fiveStars: string[];
    messages: string[];
  };
  dailyLimits?: {
    reactions: { count: number; date: string | null };
    messages: { count: number; date: string | null };
  };
  history: Array<{
    action: string;
    xp: number;
    timestamp: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface AllLevelData {
  [username: string]: UserLevelData;
}

export class LevelRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Buscar dados de nível de um usuário pelo username
   */
  async findByUsername(username: string): Promise<UserLevel | null> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { levelData: true }
    });
    return user?.levelData || null;
  }

  /**
   * Buscar dados de nível de um usuário pelo userId
   */
  async findByUserId(userId: string): Promise<UserLevel | null> {
    return this.prisma.userLevel.findUnique({
      where: { userId }
    });
  }

  /**
   * Buscar todos os dados de níveis
   */
  async findAll(): Promise<UserLevel[]> {
    return this.prisma.userLevel.findMany({
      include: {
        user: {
          select: {
            username: true,
            name: true
          }
        }
      }
    });
  }

  /**
   * Buscar todos os níveis formatados como objeto { username: data }
   */
  async getAllAsObject(): Promise<AllLevelData> {
    const levels = await this.prisma.userLevel.findMany({
      include: {
        user: {
          select: {
            username: true
          }
        }
      }
    });

    const result: AllLevelData = {};
    
    for (const level of levels) {
      if (level.user) {
        const trackedActions = level.trackedActions as any || {};
        const dailyLimits = level.dailyLimits as any || {};
        
        result[level.user.username] = {
          xp: level.xp,
          level: level.level,
          totalXP: level.totalXP,
          streak: level.streak,
          bestStreak: level.bestStreak,
          lastDaily: level.lastDaily?.toISOString() || null,
          trackedActions: {
            ratings: trackedActions.ratings || [],
            reactions: trackedActions.reactions || [],
            fiveStars: trackedActions.fiveStars || [],
            messages: trackedActions.messages || []
          },
          dailyLimits: {
            reactions: dailyLimits.reactions || { count: 0, date: null },
            messages: dailyLimits.messages || { count: 0, date: null }
          },
          history: level.history as any || [],
          createdAt: level.createdAt.toISOString(),
          updatedAt: level.updatedAt.toISOString()
        };
      }
    }

    return result;
  }

  /**
   * Salvar ou atualizar dados de nível por username
   * 
   * ✓ CORREÇÃO #7: Usar push para histórico (adiciona, não sobrescreve)
   */
  async upsertByUsername(username: string, data: Partial<UserLevelData>): Promise<UserLevel | null> {
    // Buscar userId pelo username
    const user = await this.prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      console.warn(`Usuário não encontrado: ${username}`);
      return null;
    }

    return this.prisma.userLevel.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        xp: data.xp || 0,
        level: data.level || 1,
        totalXP: data.totalXP || 0,
        streak: data.streak || 0,
        bestStreak: data.bestStreak || 0,
        lastDaily: data.lastDaily ? new Date(data.lastDaily) : null,
        trackedActions: data.trackedActions as any || { ratings: [], reactions: [], fiveStars: [], messages: [] },
        dailyLimits: data.dailyLimits as any || { reactions: { count: 0, date: null }, messages: { count: 0, date: null } },
        history: data.history as any || []
      },
      update: {
        xp: data.xp,
        level: data.level,
        totalXP: data.totalXP,
        streak: data.streak,
        bestStreak: data.bestStreak,
        lastDaily: data.lastDaily ? new Date(data.lastDaily) : undefined,
        trackedActions: data.trackedActions as any,
        dailyLimits: data.dailyLimits as any,
        // ✓ Usar push para adicionar ao histórico, não sobrescrever
        ...(data.history && data.history.length > 0 && {
          history: {
            push: data.history as any
          }
        })
      }
    });
  }

  /**
   * Salvar múltiplos níveis de uma vez (bulk upsert)
   */
  async saveAll(allData: AllLevelData): Promise<{ success: number; failed: string[] }> {
    const results = { success: 0, failed: [] as string[] };

    for (const [username, data] of Object.entries(allData)) {
      try {
        await this.upsertByUsername(username, data);
        results.success++;
      } catch (error) {
        console.error(`Erro ao salvar nível de ${username}:`, error);
        results.failed.push(username);
      }
    }

    return results;
  }

  /**
   * Deletar dados de nível de um usuário
   */
  async deleteByUsername(username: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { username }
    });

    if (!user) return false;

    try {
      await this.prisma.userLevel.delete({
        where: { userId: user.id }
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Deletar todos os dados de níveis
   */
  async deleteAll(): Promise<number> {
    const result = await this.prisma.userLevel.deleteMany();
    return result.count;
  }

  /**
   * Ranking de níveis (top N usuários)
   */
  async getRanking(limit: number = 10): Promise<Array<{
    username: string;
    name: string;
    level: number;
    totalXP: number;
  }>> {
    const levels = await this.prisma.userLevel.findMany({
      orderBy: { totalXP: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            username: true,
            name: true
          }
        }
      }
    });

    return levels.map(l => ({
      username: l.user?.username || '',
      name: l.user?.name || '',
      level: l.level,
      totalXP: l.totalXP
    }));
  }
}
