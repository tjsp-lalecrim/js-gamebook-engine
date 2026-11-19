export class LootSystem {
  static CATALOG = {
    'Poção de Cura Menor': {
      id: 'pocao-cura-menor',
      type: 'consumable',
      category: 'potion',
      rarity: 'common',
      heal: 18,
      description: 'Restaura 18 pontos de HP.'
    },
    'Poção de Vitalidade': {
      id: 'pocao-vitalidade',
      type: 'consumable',
      category: 'potion',
      rarity: 'rare',
      fullHeal: true,
      description: 'Restaura 100% dos pontos de HP.'
    },
    'Elixir de Força': {
      id: 'elixir-forca',
      type: 'consumable',
      category: 'potion',
      rarity: 'uncommon',
      heal: 8,
      statBoost: { forca: 3 },
      description: 'Recupera 8 de HP e aumenta Força em +3.'
    },
    'Elixir de Agilidade': {
      id: 'elixir-agilidade',
      type: 'consumable',
      category: 'potion',
      rarity: 'uncommon',
      heal: 6,
      statBoost: { agilidade: 3 },
      description: 'Recupera 6 de HP e aumenta Agilidade em +3.'
    },
    'Pergaminho de Sabedoria': {
      id: 'pergaminho-sabedoria',
      type: 'consumable',
      category: 'scroll',
      rarity: 'uncommon',
      statBoost: { inteligencia: 3 },
      description: 'Aumenta Inteligência em +3.'
    },
    'Chave de Ferro': {
      id: 'chave-de-ferro',
      type: 'gear_or_quest',
      category: 'key',
      rarity: 'common',
      description: 'Chave pesada usada para destrancar portas e grades nas masmorras.'
    },
    'Adaga Imperial': {
      id: 'adaga-imperial',
      type: 'gear_or_quest',
      category: 'weapon',
      rarity: 'uncommon',
      description: 'Lâmina leve de aço imperial, útil em combates próximos e mecanismos.'
    },
    'Fragmento do Cajado (1/8)': {
      id: 'fragmento-cajado-1',
      type: 'gear_or_quest',
      category: 'quest',
      rarity: 'legendary',
      description: 'Parte ancestral do Cajado do Caos, carregada de energia arcana.'
    }
  };

  static setCatalogFromData(itemsData) {
    const list = Array.isArray(itemsData) ? itemsData : itemsData?.items;
    if (!Array.isArray(list) || list.length === 0) return;

    const nextCatalog = {};
    for (const entry of list) {
      if (!entry || !entry.name) continue;
      nextCatalog[entry.name] = {
        id: entry.id || entry.name,
        type: entry.type || (entry.heal || entry.fullHeal || entry.statBoost ? 'consumable' : 'gear_or_quest'),
        category: entry.category || 'misc',
        rarity: entry.rarity || 'common',
        heal: entry.heal ?? 0,
        fullHeal: Boolean(entry.fullHeal),
        statBoost: entry.statBoost || null,
        description: entry.description || 'Item de aventura.'
      };
    }

    if (Object.keys(nextCatalog).length > 0) {
      this.CATALOG = nextCatalog;
    }
  }

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