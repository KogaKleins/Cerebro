/**
 * User Repository - Acesso a dados de usuários via Prisma
 */

import { PrismaClient, User, Role } from '@prisma/client';

export class UserRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Buscar usuário por username
   */
  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username }
    });
  }

  /**
   * Buscar usuário por ID
   */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id }
    });
  }

  /**
   * Buscar todos os usuários
   */
  async findAll(): Promise<User[]> {
    return this.prisma.user.findMany({
      orderBy: { name: 'asc' }
    });
  }

  /**
   * Criar novo usuário
   */
  async create(data: {
    username: string;
    password: string;
    name: string;
    role: Role;
    avatar: string;
    setor: string;
    photo?: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data
    });
  }

  /**
   * Atualizar usuário
   */
  async update(id: string, data: Partial<User>): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data
    });
  }

  /**
   * Deletar usuário
   */
  async delete(id: string): Promise<User> {
    return this.prisma.user.delete({
      where: { id }
    });
  }

  /**
   * Contar usuários
   */
  async count(): Promise<number> {
    return this.prisma.user.count();
  }

  /**
   * 🆕 Banir usuário
   */
  async banUser(username: string, reason: string, durationMs: number): Promise<User | null> {
    const user = await this.findByUsername(username);
    if (!user) return null;

    return this.prisma.user.update({
      where: { username },
      data: {
        bannedUntil: new Date(Date.now() + durationMs),
        banReason: reason
      }
    });
  }

  /**
   * 🆕 Desbanir usuário
   */
  async unbanUser(username: string): Promise<User | null> {
    const user = await this.findByUsername(username);
    if (!user) return null;

    return this.prisma.user.update({
      where: { username },
      data: {
        bannedUntil: null,
        banReason: null
      }
    });
  }

  /**
   * 🆕 Verificar se usuário está banido
   */
  async getBanStatus(username: string): Promise<{ banned: boolean; until?: Date; reason?: string } | null> {
    const user = await this.findByUsername(username);
    if (!user) return null;

    const now = new Date();
    if (user.bannedUntil && user.bannedUntil > now) {
      return {
        banned: true,
        until: user.bannedUntil,
        reason: user.banReason || 'Violação das regras de moderação'
      };
    }

    // Se tinha ban mas expirou, limpar campos
    if (user.bannedUntil) {
      await this.unbanUser(username);
    }

    return { banned: false };
  }
}
