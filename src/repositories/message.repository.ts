/**
 * Message Repository - Acesso a dados de mensagens via Prisma
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * POLÍTICA DE SOFT DELETE E XP
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Quando uma mensagem é deletada pelo admin:
 * 1. A mensagem é marcada como deletada (softDelete) - NÃO é removida do banco
 * 2. O XP ganho pela mensagem é MANTIDO (decisão de design)
 * 3. A contagem para CONQUISTAS usa apenas mensagens ATIVAS (deletedAt: null)
 * 
 * RAZÃO: O XP representa a atividade histórica do usuário. Mesmo que o admin
 * delete uma mensagem (por exemplo, spam), o usuário ainda realizou a ação.
 * As conquistas, porém, recompensam o engajamento ativo, então usam apenas
 * mensagens não deletadas.
 * 
 * EXEMPLO PRÁTICO:
 * - Usuário envia 60 mensagens → ganha 60 XP
 * - Admin deleta 15 mensagens (spam)
 * - XP do usuário: 60 (mantido)
 * - Conquista "Tagarela" (50 msgs): NÃO desbloqueada (apenas 45 ativas)
 * 
 * Se desejar reverter o XP de mensagens deletadas, use o script:
 * npx ts-node scripts/reverse-deleted-messages-xp.ts
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { PrismaClient, Message } from '@prisma/client';

// Type para author info (seleção parcial)
type AuthorInfo = {
  id: string;
  name: string;
  username: string;
  avatar: string;
  setor: string;
};

// Type para mensagem com author incluído
type MessageWithAuthor = Message & {
  author: AuthorInfo;
};

export class MessageRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Criar nova mensagem
   * 🔧 CORREÇÃO: Adicionar suporte a replyTo para persistir respostas
   */
  async create(data: {
    authorId: string;
    text: string;
    replyToId?: string;
    replyToAuthor?: string;
    replyToText?: string;
  }): Promise<MessageWithAuthor> {
    return this.prisma.message.create({
      data,
      include: {
        author: {
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
   * Buscar mensagem por ID
   */
  async findById(id: string): Promise<MessageWithAuthor | null> {
    return this.prisma.message.findUnique({
      where: { id },
      include: {
        author: true
      }
    });
  }

  /**
   * Buscar mensagens recentes (não deletadas)
   * 🔧 CORREÇÃO: Incluir reactions para persistir reações ao recarregar página
   */
  async findRecent(limit = 100): Promise<MessageWithAuthor[]> {
    return this.prisma.message.findMany({
      where: {
        deletedAt: null
      },
      take: limit,
      orderBy: { timestamp: 'desc' },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            setor: true
          }
        },
        reactions: true // 🆕 Incluir reações para persistência
      }
    });
  }

  /**
   * Buscar mensagens por autor
   */
  async findByAuthor(authorId: string, limit = 100): Promise<MessageWithAuthor[]> {
    return this.prisma.message.findMany({
      where: {
        authorId,
        deletedAt: null
      },
      take: limit,
      orderBy: { timestamp: 'desc' },
      include: {
        author: true
      }
    });
  }

  /**
   * Editar mensagem
   */
  async update(id: string, text: string): Promise<Message> {
    return this.prisma.message.update({
      where: { id },
      data: {
        text,
        edited: true
      }
    });
  }

  /**
   * Deletar mensagem (soft delete)
   */
  async softDelete(id: string): Promise<Message> {
    return this.prisma.message.update({
      where: { id },
      data: {
        deletedAt: new Date()
      }
    });
  }

  /**
   * Deletar mensagem permanentemente
   */
  async hardDelete(id: string): Promise<Message> {
    return this.prisma.message.delete({
      where: { id }
    });
  }

  /**
   * Contar mensagens
   */
  async count(includeDeleted = false): Promise<number> {
    return this.prisma.message.count({
      where: includeDeleted ? undefined : { deletedAt: null }
    });
  }

  /**
   * Buscar todas mensagens (incluindo deletadas) - Admin only
   */
  async findAll(limit = 1000): Promise<MessageWithAuthor[]> {
    return this.prisma.message.findMany({
      take: limit,
      orderBy: { timestamp: 'desc' },
      include: {
        author: {
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
   * Deletar todas as mensagens (Admin only)
   */
  async deleteAll(): Promise<{ count: number }> {
    return this.prisma.message.deleteMany({});
  }

  /**
   * 🆕 Contar mensagens de um autor específico
   * Usado para verificar conquistas de mensagens
   */
  async countByAuthor(authorId: string): Promise<number> {
    return this.prisma.message.count({
      where: {
        authorId,
        deletedAt: null
      }
    });
  }

  /**
   * 🆕 Contar mensagens por username
   * Faz a busca do usuário internamente
   */
  async countByUsername(username: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { username }
    });
    if (!user) return 0;
    return this.countByAuthor(user.id);
  }
}
