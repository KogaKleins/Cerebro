/**
 * Repository para configurações do sistema
 */

import { PrismaClient, Setting } from '@prisma/client';

export class SettingRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Buscar uma configuração pelo key
   */
  async findByKey(key: string): Promise<Setting | null> {
    return this.prisma.setting.findUnique({
      where: { key }
    });
  }

  /**
   * Salvar ou atualizar uma configuração
   */
  async upsert(key: string, value: unknown, updatedBy?: string): Promise<Setting> {
    return this.prisma.setting.upsert({
      where: { key },
      create: {
        key,
        value: value as any,
        updatedBy
      },
      update: {
        value: value as any,
        updatedBy
      }
    });
  }

  /**
   * Buscar todas as configurações
   */
  async findAll(): Promise<Setting[]> {
    return this.prisma.setting.findMany();
  }

  /**
   * Deletar uma configuração
   */
  async delete(key: string): Promise<Setting | null> {
    try {
      return await this.prisma.setting.delete({
        where: { key }
      });
    } catch {
      return null;
    }
  }

  /**
   * Buscar configuração de XP
   */
  async getXPConfig(): Promise<unknown | null> {
    const setting = await this.findByKey('xp-config');
    return setting?.value || null;
  }

  /**
   * Salvar configuração de XP
   */
  async saveXPConfig(config: unknown, updatedBy?: string): Promise<Setting> {
    return this.upsert('xp-config', config, updatedBy);
  }
}
