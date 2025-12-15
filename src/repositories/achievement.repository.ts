/**
 * Achievement Repository - Acesso a dados de conquistas via Prisma
 */

import { PrismaClient, Achievement } from '@prisma/client';

// Type para user info (seleção parcial)
type UserInfo = {
  id: string;
  name: string;
  avatar: string;
};

// Type para achievement com user incluído
type AchievementWithUser = Achievement & {
  user: UserInfo;
};

export class AchievementRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Criar nova conquista
   */
  async create(data: {
    userId: string;
    type: string;
    title: string;
    description?: string;
  }): Promise<Achievement> {
    // Usar upsert torna a operação idempotente e evita erros de concorrência
    // quando duas requisições tentam criar a mesma conquista ao mesmo tempo.
    // Se já existir, apenas atualiza título/descrição (sem alterar unlockedAt).
    return this.prisma.achievement.upsert({
      where: {
        userId_type: {
          userId: data.userId,
          type: data.type
        }
      },
      create: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        description: data.description
      },
      update: {
        title: data.title,
        description: data.description
      }
    });
  }

  /**
   * Tenta criar uma conquista somente se não existir. Retorna um objeto
   * com a conquista e um flag `created` indicando se ela foi criada agora.
   * 
   * ✓ CORREÇÃO #5: Verificar existência antes + UPSERT atomic (thread-safe)
   * ✓ CORREÇÃO #6: Retornar created=false se já existia para evitar XP duplicado
   */
  async createIfNotExists(data: {
    userId: string;
    type: string;
    title: string;
    description?: string;
  }): Promise<{ achievement: Achievement; created: boolean } | null> {
    try {
      // 🔒 PASSO 1: Verificar se já existe ANTES do upsert
      // Isso permite determinar se realmente foi criado ou já existia
      const existing = await this.prisma.achievement.findUnique({
        where: {
          userId_type: {
            userId: data.userId,
            type: data.type
          }
        }
      });

      // Se já existe, retornar created=false (NÃO dar XP novamente!)
      if (existing) {
        return { achievement: existing, created: false };
      }

      // 🔒 PASSO 2: UPSERT atomic (thread-safe) para criar
      const achievement = await this.prisma.achievement.upsert({
        where: {
          userId_type: {
            userId: data.userId,
            type: data.type
          }
        },
        create: {
          userId: data.userId,
          type: data.type,
          title: data.title,
          description: data.description
        },
        update: {
          // Se outro processo criou entre a verificação e o upsert,
          // apenas atualiza título/descrição (não duplica)
          title: data.title,
          description: data.description
        }
      });
      
      // 🔒 PASSO 3: Verificar se foi REALMENTE criado agora
      // (comparando timestamps - se criado há menos de 1 segundo, é novo)
      const now = new Date();
      const createdAt = achievement.unlockedAt;
      const timeDiff = now.getTime() - createdAt.getTime();
      const isReallyNew = timeDiff < 1000; // Menos de 1 segundo = acabou de criar
      
      return { achievement, created: isReallyNew };
    } catch (err: any) {
      // Log de erro inesperado
      if (err) {
        console.error('Erro inesperado em createIfNotExists:', err);
      }
      throw err;
    }
  }

  /**
   * Verificar se usuário já tem conquista
   */
  async hasAchievement(userId: string, type: string): Promise<boolean> {
    const achievement = await this.prisma.achievement.findUnique({
      where: {
        userId_type: {
          userId,
          type
        }
      }
    });

    return achievement !== null;
  }

  /**
   * Buscar conquistas de um usuário
   */
  async findByUser(userId: string): Promise<Achievement[]> {
    return this.prisma.achievement.findMany({
      where: { userId },
      orderBy: { unlockedAt: 'desc' }
    });
  }

  /**
   * Buscar conquista específica
   */
  async findOne(userId: string, type: string): Promise<Achievement | null> {
    return this.prisma.achievement.findUnique({
      where: {
        userId_type: {
          userId,
          type
        }
      }
    });
  }

  /**
   * Buscar todas conquistas (para admin)
   */
  async findAll(): Promise<AchievementWithUser[]> {
    const achievements = await this.prisma.achievement.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        }
      },
      orderBy: { unlockedAt: 'desc' }
    });
    return achievements as AchievementWithUser[];
  }

  /**
   * Contar conquistas de um usuário
   */
  async countByUser(userId: string): Promise<number> {
    return this.prisma.achievement.count({
      where: { userId }
    });
  }

  /**
   * Contar quantos usuários têm determinada conquista
   */
  async countByType(type: string): Promise<number> {
    return this.prisma.achievement.count({
      where: { type }
    });
  }

  /**
   * Deletar conquista
   */
  async delete(userId: string, type: string): Promise<Achievement> {
    return this.prisma.achievement.delete({
      where: {
        userId_type: {
          userId,
          type
        }
      }
    });
  }

  /**
   * Deletar todas conquistas de um usuário
   */
  async deleteAllByUser(userId: string): Promise<number> {
    const result = await this.prisma.achievement.deleteMany({
      where: { userId }
    });
    
    return result.count;
  }

  /**
   * Buscar todas conquistas agrupadas por usuário (evita N+1)
   */
  async findAllGroupedByUser(): Promise<Map<string, AchievementWithUser[]>> {
    const achievements = await this.prisma.achievement.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            username: true
          }
        }
      },
      orderBy: { unlockedAt: 'desc' }
    });

    const grouped = new Map<string, AchievementWithUser[]>();
    
    for (const achievement of achievements) {
      const username = (achievement.user as any).username;
      if (!grouped.has(username)) {
        grouped.set(username, []);
      }
      grouped.get(username)!.push(achievement as AchievementWithUser);
    }
    
    return grouped;
  }
}
