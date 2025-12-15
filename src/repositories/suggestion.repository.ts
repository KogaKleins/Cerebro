/**
 * Suggestion Repository - Acesso a dados de sugestões de usuários via Prisma
 * 
 * Funcionalidades:
 * - Criar, buscar, atualizar e deletar sugestões
 * - Filtrar por status e autor
 * - Contagem por status para métricas
 */

import { PrismaClient, Suggestion, SuggestionStatus } from '@prisma/client';
import { logger } from '../utils/logger';

// Type para suggestion com author incluído
type AuthorInfo = {
  id: string;
  name: string;
  username: string;
};

type SuggestionWithAuthor = Suggestion & {
  author: AuthorInfo;
};

export class SuggestionRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Criar nova sugestão
   */
  async create(data: {
    title: string;
    content: string;
    authorId: string;
  }): Promise<SuggestionWithAuthor> {
    try {
      // Validações
      if (!data.title || data.title.trim().length === 0) {
        throw new Error('Título é obrigatório');
      }
      if (!data.content || data.content.trim().length === 0) {
        throw new Error('Conteúdo é obrigatório');
      }
      if (!data.authorId) {
        throw new Error('ID do autor é obrigatório');
      }

      // Sanitizar dados
      const sanitizedData = {
        title: data.title.trim().substring(0, 100),
        content: data.content.trim().substring(0, 2000),
        authorId: data.authorId
      };

      return await this.prisma.suggestion.create({
        data: sanitizedData,
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
    } catch (error) {
      logger.error('Erro ao criar sugestão', { error, data });
      throw error;
    }
  }

  /**
   * Buscar sugestão por ID
   */
  async findById(id: string): Promise<SuggestionWithAuthor | null> {
    try {
      if (!id) return null;
      
      return await this.prisma.suggestion.findUnique({
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
    } catch (error) {
      logger.error('Erro ao buscar sugestão por ID', { error, id });
      return null;
    }
  }

  /**
   * Buscar sugestões do usuário
   */
  async findByAuthor(authorId: string, limit = 20): Promise<SuggestionWithAuthor[]> {
    try {
      if (!authorId) return [];
      
      return await this.prisma.suggestion.findMany({
        where: { authorId },
        take: Math.min(limit, 100), // Limitar máximo
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
    } catch (error) {
      logger.error('Erro ao buscar sugestões por autor', { error, authorId });
      return [];
    }
  }

  /**
   * Buscar todas as sugestões (para admin)
   */
  async findAll(options?: {
    status?: SuggestionStatus;
    limit?: number;
    offset?: number;
  }): Promise<SuggestionWithAuthor[]> {
    try {
      const { status, limit = 50, offset = 0 } = options || {};
      
      return await this.prisma.suggestion.findMany({
        where: status ? { status } : undefined,
        take: Math.min(limit, 100), // Limitar máximo
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
    } catch (error) {
      logger.error('Erro ao buscar todas as sugestões', { error, options });
      return [];
    }
  }

  /**
   * Contar sugestões por status
   */
  async countByStatus(): Promise<Record<string, number>> {
    try {
      const counts = await this.prisma.suggestion.groupBy({
        by: ['status'],
        _count: true
      });
      
      const result: Record<string, number> = {
        PENDING: 0,
        REVIEWING: 0,
        APPROVED: 0,
        REJECTED: 0,
        IMPLEMENTED: 0
      };
      
      counts.forEach(c => {
        result[c.status] = c._count;
      });
      
      return result;
    } catch (error) {
      logger.error('Erro ao contar sugestões por status', { error });
      return {
        PENDING: 0,
        REVIEWING: 0,
        APPROVED: 0,
        REJECTED: 0,
        IMPLEMENTED: 0
      };
    }
  }

  /**
   * Contar total de sugestões
   */
  async count(status?: SuggestionStatus): Promise<number> {
    try {
      return await this.prisma.suggestion.count({
        where: status ? { status } : undefined
      });
    } catch (error) {
      logger.error('Erro ao contar sugestões', { error, status });
      return 0;
    }
  }

  /**
   * Atualizar status da sugestão (admin)
   */
  async updateStatus(id: string, status: SuggestionStatus, adminNotes?: string): Promise<SuggestionWithAuthor> {
    try {
      if (!id) {
        throw new Error('ID é obrigatório');
      }
      
      // Validar status
      const validStatuses: SuggestionStatus[] = ['PENDING', 'REVIEWING', 'APPROVED', 'REJECTED', 'IMPLEMENTED'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Status inválido: ${status}`);
      }

      return await this.prisma.suggestion.update({
        where: { id },
        data: {
          status,
          adminNotes: adminNotes?.trim().substring(0, 1000) || undefined
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
    } catch (error) {
      logger.error('Erro ao atualizar status da sugestão', { error, id, status });
      throw error;
    }
  }

  /**
   * Deletar sugestão
   */
  async delete(id: string): Promise<Suggestion> {
    try {
      if (!id) {
        throw new Error('ID é obrigatório');
      }
      
      return await this.prisma.suggestion.delete({
        where: { id }
      });
    } catch (error) {
      logger.error('Erro ao deletar sugestão', { error, id });
      throw error;
    }
  }

  /**
   * Verificar se usuário atingiu limite de sugestões pendentes
   */
  async countPendingByAuthor(authorId: string): Promise<number> {
    try {
      return await this.prisma.suggestion.count({
        where: {
          authorId,
          status: 'PENDING'
        }
      });
    } catch (error) {
      logger.error('Erro ao contar sugestões pendentes do autor', { error, authorId });
      return 0;
    }
  }
}
