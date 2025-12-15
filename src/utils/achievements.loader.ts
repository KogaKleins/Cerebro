import fs from 'fs';
import path from 'path';

/**
 * Carrega mapa de raridades das conquistas lendo o arquivo JS de definições do frontend.
 * Isso evita duplicação manual e mantém backend alinhado com frontend.
 */
export async function loadAchievementRarities(): Promise<Record<string, string>> {
  try {
    const defsPath = path.join(__dirname, '..', '..', 'js', 'achievements', 'definitions.js');
    const content = await fs.promises.readFile(defsPath, 'utf8');

    // Regex para capturar blocos de definição: 'achievement-id': { ... rarity: 'rare' ... }
    const map: Record<string, string> = {};
    const blockRegex = /['"]([a-z0-9-]+)['"]\s*:\s*\{([\s\S]*?)\}/gi;
    let match: RegExpExecArray | null;

    while ((match = blockRegex.exec(content)) !== null) {
      const id = match[1];
      const body = match[2];
      const rarityMatch = /rarity\s*:\s*['"](\w+)['"]/i.exec(body);
      if (rarityMatch) {
        map[id] = rarityMatch[1];
      }
    }

    return map;
  } catch (error) {
    // Em caso de falha, retornar mapa vazio para não quebrar o recálculo
    return {};
  }
}
