export class LootSystem {
  static CATALOG = {
    'Poção de Cura Menor': {
      type: 'consumable',
      heal: 18,
      description: 'Restaura 18 pontos de HP.'
    },
    'Poção de Vitalidade': {
      type: 'consumable',
      fullHeal: true,
      description: 'Restaura 100% dos pontos de HP.'
    },
    'Elixir de Força': {
      type: 'consumable',
      heal: 8,
      statBoost: { forca: 3 },
      description: 'Recupera 8 de HP e aumenta Força em +3.'
    },
    'Pergaminho de Sabedoria': {
      type: 'consumable',
      statBoost: { inteligencia: 3 },
      description: 'Aumenta Inteligência em +3.'
    }
  };

  static getItemMetadata(itemName) {
    if (!itemName) return null;
    if (this.CATALOG[itemName]) {
      return { name: itemName, ...this.CATALOG[itemName] };
    }
    const lower = itemName.toLowerCase();
    if (lower.includes('poção de cura') || lower.includes('cura')) {
      return {
        name: itemName,
        type: 'consumable',
        heal: 15,
        description: 'Restaura 15 pontos de HP.'
      };
    }
    return {
      name: itemName,
      type: 'gear_or_quest',
      description: 'Item de aventura ou missão.'
    };
  }

  static resolveLootEntries(entries = []) {
    if (!Array.isArray(entries) || entries.length === 0) return [];
    const granted = [];

    for (const entry of entries) {
      const itemName = typeof entry === 'string' ? entry : (entry?.item || entry?.name);
      if (!itemName) continue;

      const chance = typeof entry === 'object' && entry.chance !== undefined
        ? Number(entry.chance)
        : 100;

      const roll = Math.random() * 100;
      if (roll <= chance) {
        const minQty = Math.max(1, Number(entry?.minQty ?? entry?.qty ?? 1));
        const maxQty = Math.max(minQty, Number(entry?.maxQty ?? minQty));
        const quantity = Math.floor(Math.random() * (maxQty - minQty + 1)) + minQty;

        for (let i = 0; i < quantity; i += 1) {
          granted.push(itemName);
        }
      }
    }

    return granted;
  }

  static collectSourceLoot(source = {}) {
    if (!source || typeof source !== 'object') return [];
    const items = [];

    if (source.giveItem) {
      items.push(source.giveItem);
    }

    if (source.lootItem) {
      items.push(source.lootItem);
    }

    const table = source.lootTable || source.loot || [];
    items.push(...this.resolveLootEntries(table));

    return items;
  }

  static summarizeLootLabels(source = {}) {
    if (!source || typeof source !== 'object') return [];
    const labels = new Set();

    if (source.giveItem) labels.add(source.giveItem);
    if (source.lootItem) labels.add(source.lootItem);

    const table = source.lootTable || source.loot || [];
    if (Array.isArray(table)) {
      for (const entry of table) {
        const name = typeof entry === 'string' ? entry : (entry?.item || entry?.name);
        if (!name) continue;
        const chance = typeof entry === 'object' && entry.chance !== undefined ? Number(entry.chance) : 100;
        labels.add(chance < 100 ? `${name} (${chance}%)` : name);
      }
    }

    return Array.from(labels);
  }
}