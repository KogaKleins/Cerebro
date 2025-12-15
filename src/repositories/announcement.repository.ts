/**
 * Announcement Repository - Acesso a dados de comunicados/anúncios via Prisma
 */

import { PrismaClient, Announcement, AnnouncementPriority } from '@prisma/client';

// Type para announcement com author incluído
type AuthorInfo = {
  id: string;
  name: string;
  username: string;
};

type AnnouncementWithAuthor = Announcement & {
  author: AuthorInfo;
};

export class AnnouncementRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Criar novo comunicado
   */
  async create(data: {
    title: string;
    content: string;
    priority?: AnnouncementPriority;
    authorId: string;
    expiresAt?: Date;
  }): Promise<AnnouncementWithAuthor> {
    return this.prisma.announcement.create({
      data: {
        title: data.title,
        content: data.content,
        priority: data.priority || 'NORMAL',
        authorId: data.authorId,
        expiresAt: data.expiresAt
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      }
    });
  }

  /**
   * Buscar comunicado por ID
   */
  async findById(id: string): Promise<AnnouncementWithAuthor | null> {
    return this.prisma.announcement.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      }
    });
  }

  /**
   * Buscar comunicados ativos (não expirados)
   */
  async findActive(limit = 10): Promise<AnnouncementWithAuthor[]> {
    const now = new Date();
    
    return this.prisma.announcement.findMany({
      where: {
        active: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } }
        ]
      },
      take: limit,
      orderBy: [
        { priority: 'desc' }, // URGENT > HIGH > NORMAL > LOW
        { createdAt: 'desc' }
      ],
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      }
    });
  }

  /**
   * Buscar todos os comunicados (para admin)
   */
  async findAll(limit = 50, offset = 0): Promise<AnnouncementWithAuthor[]> {
    return this.prisma.announcement.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      }
    });
  }

  /**
   * Contar total de comunicados
   */
  async count(): Promise<number> {
    return this.prisma.announcement.count();
  }

  /**
   * Atualizar comunicado
   */
  async update(id: string, data: {
    title?: string;
    content?: string;
    priority?: AnnouncementPriority;
    active?: boolean;
    expiresAt?: Date | null;
  }): Promise<AnnouncementWithAuthor> {
    return this.prisma.announcement.update({
      where: { id },
      data,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      }
    });
  }

  /**
   * Deletar comunicado
   */
  async delete(id: string): Promise<Announcement> {
    return this.prisma.announcement.delete({
      where: { id }
    });
  }
}
