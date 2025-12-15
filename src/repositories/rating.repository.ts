/**
 * Rating Repository - Acesso a dados de avaliações via Prisma
 */

import { PrismaClient, Rating } from '@prisma/client';

// Type para user info (seleção parcial)
type UserInfo = {
  id: string;
  name: string;
  avatar: string;
};

// Type para rating com user incluído
type RatingWithUser = Rating & {
  user: UserInfo;
};

export class RatingRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Criar ou atualizar avaliação
   */
  async upsert(data: {
    coffeeId: string;
    userId: string;
    rating: number;
  }): Promise<Rating> {
    return this.prisma.rating.upsert({
      where: {
        coffeeId_userId: {
          coffeeId: data.coffeeId,
          userId: data.userId
        }
      },
      update: {
        rating: data.rating,
        createdAt: new Date() // Atualiza timestamp
      },
      create: data
    });
  }

  /**
   * Buscar avaliação específica
   */
  async findOne(coffeeId: string, userId: string): Promise<Rating | null> {
    return this.prisma.rating.findUnique({
      where: {
        coffeeId_userId: {
          coffeeId,
          userId
        }
      }
    });
  }

  /**
   * Buscar avaliações de um café
   */
  async findByCoffee(coffeeId: string): Promise<RatingWithUser[]> {
    return this.prisma.rating.findMany({
      where: { coffeeId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Buscar avaliações de um usuário
   */
  async findByUser(userId: string): Promise<Rating[]> {
    return this.prisma.rating.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Calcular média de avaliações de um café
   */
  async getAverageForCoffee(coffeeId: string): Promise<number> {
    const result = await this.prisma.rating.aggregate({
      where: { coffeeId },
      _avg: { rating: true }
    });

    return result._avg.rating || 0;
  }

  /**
   * Deletar avaliação
   */
  async delete(coffeeId: string, userId: string): Promise<Rating> {
    return this.prisma.rating.delete({
      where: {
        coffeeId_userId: {
          coffeeId,
          userId
        }
      }
    });
  }

  /**
   * 🆕 Contar avaliações de 5 estrelas recebidas por um usuário (maker dos cafés)
   * Usado para verificar conquistas de "five-star-received"
   */
  async countFiveStarsReceivedByUser(userId: string): Promise<number> {
    return this.prisma.rating.count({
      where: {
        rating: 5,
        coffee: {
          makerId: userId
        }
      }
    });
  }

  /**
   * 🆕 Obter estatísticas completas de ratings recebidos por um usuário
   * Retorna: total de avaliações, 5 estrelas, 4 estrelas, média
   */
  async getRatingStatsForMaker(userId: string): Promise<{
    totalRatings: number;
    fiveStarCount: number;
    fourStarCount: number;
    averageRating: number;
  }> {
    const [totalRatings, fiveStarCount, fourStarCount, avgResult] = await Promise.all([
      // Total de avaliações recebidas
      this.prisma.rating.count({
        where: { coffee: { makerId: userId } }
      }),
      // Avaliações 5 estrelas
      this.prisma.rating.count({
        where: { 
          rating: 5,
          coffee: { makerId: userId } 
        }
      }),
      // Avaliações 4 estrelas
      this.prisma.rating.count({
        where: { 
          rating: 4,
          coffee: { makerId: userId } 
        }
      }),
      // Média de avaliações
      this.prisma.rating.aggregate({
        where: { coffee: { makerId: userId } },
        _avg: { rating: true }
      })
    ]);

    return {
      totalRatings,
      fiveStarCount,
      fourStarCount,
      averageRating: avgResult._avg.rating || 0
    };
  }

  /**
   * Contar avaliações
   */
  async count(coffeeId?: string): Promise<number> {
    return this.prisma.rating.count({
      where: coffeeId ? { coffeeId } : undefined
    });
  }

  /**
   * 🆕 Contar quantas avaliações um usuário DEU (não recebeu)
   * Usado para conquistas: first-rate, taste-expert, sommelier
   */
  async countRatingsGivenByUser(userId: string): Promise<number> {
    return this.prisma.rating.count({
      where: {
        userId: userId
      }
    });
  }

  /**
   * 🆕 Verificar se um café recebeu X avaliações 5 estrelas (para conquista unanimous)
   * @param coffeeId - ID do café
   * @param minRatings - Quantidade mínima de avaliações 5 estrelas (default: 5)
   * @returns true se o café tem pelo menos minRatings avaliações 5 estrelas
   */
  async hasCoffeeFiveStarCount(coffeeId: string, minRatings: number = 5): Promise<boolean> {
    const count = await this.prisma.rating.count({
      where: {
        coffeeId,
        rating: 5
      }
    });
    return count >= minRatings;
  }

  /**
   * 🆕 Buscar cafés de um usuário que têm múltiplas avaliações 5 estrelas
   * Usado para conquistas "double-rainbow" (2x 5 estrelas) e "unanimous" (5x 5 estrelas)
   */
  async getCoffeesWithMultipleFiveStars(makerId: string, minCount: number = 2): Promise<Array<{ coffeeId: string; count: number }>> {
    const result = await this.prisma.rating.groupBy({
      by: ['coffeeId'],
      where: {
        rating: 5,
        coffee: {
          makerId
        }
      },
      _count: {
        rating: true
      },
      having: {
        rating: {
          _count: {
            gte: minCount
          }
        }
      }
    });

    return result.map(r => ({
      coffeeId: r.coffeeId,
      count: r._count.rating
    }));
  }

  /**
   * Deletar todas as avaliações (Admin only)
   */
  async deleteAll(): Promise<{ count: number }> {
    return this.prisma.rating.deleteMany({});
  }
}
