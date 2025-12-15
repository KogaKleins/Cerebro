/**
 * Coffee Repository - Acesso a dados de cafés via Prisma
 */

import { PrismaClient, Coffee, CoffeeType, Rating } from '@prisma/client';

// Type para maker (seleção parcial)
type MakerInfo = {
  id: string;
  name: string;
  username: string; // 🔧 CORREÇÃO: Adicionado username para notificações
  avatar: string;
  setor: string;
};

// Type para café com maker incluído
type CoffeeWithMaker = Coffee & {
  maker: MakerInfo;
};

// Type para café com maker e ratings
type CoffeeWithDetails = Coffee & {
  maker: MakerInfo;
  ratings: Rating[];
};

export class CoffeeRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Criar novo café
   */
  async create(data: {
    type: CoffeeType;
    makerId: string;
    quantity?: number;
    description?: string;
  }): Promise<CoffeeWithMaker> {
    return this.prisma.coffee.create({
      data,
      include: {
        maker: {
          select: { 
            id: true,
            name: true,
            username: true,
            avatar: true,
            setor: true 
          }
        }
      }
    });
  }

  /**
   * Buscar café por ID
   */
  async findById(id: string): Promise<CoffeeWithDetails | null> {
    return this.prisma.coffee.findUnique({
      where: { id },
      include: {
        maker: true,
        ratings: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true
              }
            }
          }
        }
      }
    });
  }

  /**
   * Buscar cafés recentes
   */
  async findRecent(limit = 50): Promise<CoffeeWithDetails[]> {
    return this.prisma.coffee.findMany({
      take: limit,
      orderBy: { timestamp: 'desc' },
      include: {
        maker: true,
        ratings: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true
              }
            }
          }
        }
      }
    });
  }

  /**
   * Buscar cafés por maker
   */
  async findByMaker(makerId: string, limit = 50): Promise<CoffeeWithDetails[]> {
    return this.prisma.coffee.findMany({
      where: { makerId },
      take: limit,
      orderBy: { timestamp: 'desc' },
      include: {
        maker: true,
        ratings: true
      }
    });
  }

  /**
   * 🆕 Buscar cafés FEITOS (type=MADE) por maker
   * ⚠️ CRÍTICO: Use este método para conquistas de horário especial e streaks!
   * Conquistas como early-bird, friday-finisher, streaks devem considerar
   * apenas cafés que o usuário FEZ, não cafés que ele TROUXE.
   */
  async findMadeByMaker(makerId: string, limit = 1000): Promise<CoffeeWithDetails[]> {
    return this.prisma.coffee.findMany({
      where: { 
        makerId,
        type: 'MADE'  // 🔒 CRÍTICO: Apenas cafés FEITOS!
      },
      take: limit,
      orderBy: { timestamp: 'desc' },
      include: {
        maker: true,
        ratings: true
      }
    });
  }

  /**
   * 🆕 Buscar cafés TRAZIDOS (type=BROUGHT) por maker
   */
  async findBroughtByMaker(makerId: string, limit = 1000): Promise<CoffeeWithDetails[]> {
    return this.prisma.coffee.findMany({
      where: { 
        makerId,
        type: 'BROUGHT'
      },
      take: limit,
      orderBy: { timestamp: 'desc' },
      include: {
        maker: true,
        ratings: true
      }
    });
  }

  /**
   * Buscar cafés por tipo
   */
  async findByType(type: CoffeeType, limit = 50): Promise<CoffeeWithDetails[]> {
    return this.prisma.coffee.findMany({
      where: { type },
      take: limit,
      orderBy: { timestamp: 'desc' },
      include: {
        maker: true,
        ratings: true
      }
    });
  }

  /**
   * Contar cafés por usuário desde uma data
   */
  async countByUserSince(makerId: string, since: Date): Promise<number> {
    return this.prisma.coffee.count({
      where: {
        makerId,
        timestamp: {
          gte: since
        }
      }
    });
  }

  /**
   * Estatísticas de café por usuário
   */
  async getStatsByUser(userId: string) {
    const [totalMade, totalBrought, avgRating] = await Promise.all([
      this.prisma.coffee.count({
        where: { makerId: userId, type: 'MADE' }
      }),
      this.prisma.coffee.count({
        where: { makerId: userId, type: 'BROUGHT' }
      }),
      this.prisma.rating.aggregate({
        where: { coffee: { makerId: userId } },
        _avg: { rating: true }
      })
    ]);

    return {
      totalMade,
      totalBrought,
      total: totalMade + totalBrought,
      avgRating: avgRating._avg.rating || 0
    };
  }

  /**
   * Estatísticas gerais
   */
  async getOverallStats() {
    const [totalCoffees, totalMade, totalBrought, avgRating] = await Promise.all([
      this.prisma.coffee.count(),
      this.prisma.coffee.count({ where: { type: 'MADE' } }),
      this.prisma.coffee.count({ where: { type: 'BROUGHT' } }),
      this.prisma.rating.aggregate({
        _avg: { rating: true }
      })
    ]);

    return {
      totalCoffees,
      totalMade,
      totalBrought,
      avgRating: avgRating._avg.rating || 0
    };
  }

  /**
   * Deletar café
   */
  async delete(id: string): Promise<Coffee> {
    return this.prisma.coffee.delete({
      where: { id }
    });
  }

  /**
   * Deletar todos os cafés (Admin only)
   */
  async deleteAll(): Promise<{ count: number }> {
    return this.prisma.coffee.deleteMany({});
  }

  /**
   * Deletar cafés por tipo (Admin only)
   */
  async deleteByType(type: CoffeeType): Promise<{ count: number }> {
    return this.prisma.coffee.deleteMany({
      where: { type }
    });
  }
}
