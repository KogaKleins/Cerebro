/**
 * 🆕 Reaction Repository - Persiste reações de mensagens no banco
 * 
 * TODAS as reações são salvas aqui para:
 * 1. Calcular XP corretamente (quem deu, quem recebeu)
 * 2. Permitir recálculo de XP sem perder dados
 * 3. Verificar conquistas baseadas em reações
 * 
 * NOTA: messageId referencia a tabela Message
 *       userId é o username do usuário que reagiu
 */

import { PrismaClient, MessageReaction } from '@prisma/client';

export class ReactionRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Adicionar uma reação (idempotente - não duplica)
   */
  async addReaction(data: {
    messageId: string;
    userId: string;
    emoji: string;
  }): Promise<{ reaction: MessageReaction; created: boolean }> {
    // Tentar criar, se já existir retorna o existente
    const existing = await this.prisma.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId: data.messageId,
          userId: data.userId,
          emoji: data.emoji
        }
      }
    });

    if (existing) {
      return { reaction: existing, created: false };
    }

    const reaction = await this.prisma.messageReaction.create({
      data: {
        messageId: data.messageId,
        userId: data.userId,
        emoji: data.emoji
      }
    });

    return { reaction, created: true };
  }

  /**
   * Remover uma reação
   */
  async removeReaction(data: {
    messageId: string;
    userId: string;
    emoji: string;
  }): Promise<boolean> {
    try {
      await this.prisma.messageReaction.delete({
        where: {
          messageId_userId_emoji: {
            messageId: data.messageId,
            userId: data.userId,
            emoji: data.emoji
          }
        }
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Buscar todas as reações de uma mensagem
   */
  async getReactionsByMessage(messageId: string): Promise<MessageReaction[]> {
    return this.prisma.messageReaction.findMany({
      where: { messageId },
      orderBy: { createdAt: 'asc' }
    });
  }

  /**
   * Contar reações DADAS por um usuário (para conquistas)
   */
  async countReactionsGivenByUser(userId: string): Promise<number> {
    return this.prisma.messageReaction.count({
      where: { userId }
    });
  }

  /**
   * Contar reações RECEBIDAS por um usuário (mensagens dele que receberam reação)
   */
  async countReactionsReceivedByUser(authorId: string): Promise<number> {
    return this.prisma.messageReaction.count({
      where: {
        message: {
          authorId: authorId
        }
      }
    });
  }

  /**
   * Buscar reações dadas por um usuário
   */
  async getReactionsGivenByUser(userId: string, limit: number = 100): Promise<MessageReaction[]> {
    return this.prisma.messageReaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  /**
   * Buscar reações recebidas por um usuário
   */
  async getReactionsReceivedByUser(authorId: string, limit: number = 100): Promise<MessageReaction[]> {
    return this.prisma.messageReaction.findMany({
      where: {
        message: {
          authorId: authorId
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  /**
   * Contar emojis únicos usados por um usuário
   */
  async countUniqueEmojisUsedByUser(userId: string): Promise<number> {
    const result = await this.prisma.messageReaction.groupBy({
      by: ['emoji'],
      where: { userId }
    });
    return result.length;
  }

  /**
   * Estatísticas de reações de um usuário
   * 🔧 CORREÇÃO: Este método agora requer 2 parâmetros separados:
   * - username: para reações dadas e emojis únicos (campo userId na tabela é username)
   * - authorId: UUID do usuário para reações recebidas (mensagens dele)
   * 
   * NOTA: Para manter compatibilidade, se apenas um parâmetro for passado,
   * assume que é username e retorna 0 para reações recebidas
   */
  async getReactionStatsForUser(
    username: string, 
    authorId?: string
  ): Promise<{
    given: number;
    received: number;
    uniqueEmojis: number;
  }> {
    const [given, received, uniqueEmojis] = await Promise.all([
      this.countReactionsGivenByUser(username),
      // Só busca recebidas se authorId for passado
      authorId ? this.countReactionsReceivedByUser(authorId) : Promise.resolve(0),
      this.countUniqueEmojisUsedByUser(username)
    ]);

    return { given, received, uniqueEmojis };
  }

  /**
   * Verificar se usuário já reagiu a uma mensagem com um emoji específico
   */
  async hasUserReacted(messageId: string, userId: string, emoji: string): Promise<boolean> {
    const count = await this.prisma.messageReaction.count({
      where: {
        messageId,
        userId,
        emoji
      }
    });
    return count > 0;
  }

  /**
   * Deletar todas as reações (Admin only)
   */
  async deleteAll(): Promise<{ count: number }> {
    return this.prisma.messageReaction.deleteMany({});
  }
}
