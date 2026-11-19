import { CombatSystem } from './combat.js';
import { DiceSystem } from './dice.js';
import { LootSystem } from './loot.js';
import { ProgressionSystem } from './progression.js';
import { WorldMapSystem } from './world.js';

const SAVE_PREFIX = 'livro_jogo_cap_save_';

export class GameEngine {
  constructor() {
    this.allBooks = [];
    this.defaultStats = {};
    this.currentBook = null;
    this.state = this.createEmptyState();
    this.activeCombat = null;
  }

  createEmptyState() {
    const initialStats = {};
    const initialProgression = ProgressionSystem.createInitialProgression();
    return {
      chapterIndex: 0,
      unlockedChapter: 0,
      locationId: null,
      visitedLocations: [],
      blockId: null,
      inventory: [],
      stats: initialStats,
      health: CombatSystem.createInitialHealth(initialStats, initialProgression.level),
      progression: initialProgression,
      history: []
    };
  }

  normalizeLoadedState(savedState) {
    const base = this.createEmptyState();
    const mergedProgression = {
      ...ProgressionSystem.createInitialProgression(),
      ...(savedState?.progression || {})
    };
    mergedProgression.xpToNextLevel = ProgressionSystem.getXpForNextLevel(mergedProgression.level);

    const stats = savedState?.stats || {};
    const health = savedState?.health
      ? CombatSystem.syncMaxHp(savedState.health, stats, mergedProgression.level)
      : CombatSystem.createInitialHealth(stats, mergedProgression.level);

    const normalized = {
      ...base,
      ...savedState,
      visitedLocations: Array.isArray(savedState?.visitedLocations) ? savedState.visitedLocations : [],
      inventory: Array.isArray(savedState?.inventory) ? savedState.inventory : [],
      stats,
      health,
      progression: mergedProgression,
      history: Array.isArray(savedState?.history) ? savedState.history : []
    };

    if (this.currentBook) {
      const resolvedLoc = WorldMapSystem.resolveCurrentLocationId(this.currentBook, normalized);
      normalized.locationId = resolvedLoc;
      if (resolvedLoc && !normalized.visitedLocations.includes(resolvedLoc)) {
        normalized.visitedLocations.push(resolvedLoc);
      }
    }

    return normalized;
  }

  async loadGameData() {
    try {
      const [booksRes, statsRes] = await Promise.all([
        fetch('./data/books.json'),
        fetch('./data/Stats.json')
      ]);

      if (!booksRes.ok || !statsRes.ok) {
        throw new Error('Falha ao carregar os arquivos JSON de dados.');
      }

      this.allBooks = await booksRes.json();
      const statsData = await statsRes.json();
      this.defaultStats = statsData.defaultStats || {};

      return { books: this.allBooks, stats: this.defaultStats };
    } catch (error) {
      console.error('Erro ao carregar dados do jogo:', error);
      throw error;
    }
  }

  buildInitialStats(book) {
    return {
      ...this.defaultStats,
      ...(book?.initialStats || {})
    };
  }

  openBook(book) {
    this.currentBook = book;
    this.activeCombat = null;
    const savedData = localStorage.getItem(SAVE_PREFIX + book.id);

    if (savedData) {
      this.state = this.normalizeLoadedState(JSON.parse(savedData));
      return this.state;
    }

    const startLoc = WorldMapSystem.getBookLocations(book)[0] || null;
    const initialStats = this.buildInitialStats(book);
    const initialProgression = ProgressionSystem.createInitialProgression();

    this.state = {
      chapterIndex: 0,
      unlockedChapter: 0,
      locationId: startLoc ? startLoc.id : null,
      visitedLocations: startLoc ? [startLoc.id] : [],
      blockId: startLoc?.blockId || book.chapters[0].startBlock,
      inventory: [],
      stats: initialStats,
      health: CombatSystem.createInitialHealth(initialStats, initialProgression.level),
      progression: initialProgression,
      history: []
    };

    this.moveToBlock(this.state.blockId);
    return this.state;
  }

  getLocations() {
    if (!this.currentBook) return [];
    return WorldMapSystem.getBookLocations(this.currentBook);
  }

  getCurrentLocation() {
    if (!this.currentBook) return null;
    const locId = WorldMapSystem.resolveCurrentLocationId(this.currentBook, this.state);
    this.state.locationId = locId;
    return WorldMapSystem.getLocationById(this.currentBook, locId);
  }

  travelToLocation(locationId) {
    if (!this.currentBook) return null;
    const location = WorldMapSystem.getLocationById(this.currentBook, locationId);
    if (!location) return null;

    const availability = WorldMapSystem.evaluateTravelAvailability(location, this.state);
    if (!availability.canTravel) return null;

    const targetChapterIdx = location.chapterIndex ?? this.state.chapterIndex;
    const chapter = this.currentBook.chapters[targetChapterIdx];
    if (!chapter) return null;

    const targetBlockId = location.blockId || chapter.startBlock;
    if (!chapter.blocks?.[targetBlockId]) return null;

    this.state.chapterIndex = targetChapterIdx;
    if (targetChapterIdx > this.state.unlockedChapter) {
      this.state.unlockedChapter = targetChapterIdx;
    }

    this.state.locationId = location.id;
    if (!this.state.visitedLocations.includes(location.id)) {
      this.state.visitedLocations.push(location.id);
    }

    this.recordLog(chapter.title, `Você viajou para ${location.name} (${location.region}).`);
    return this.moveToBlock(targetBlockId);
  }

  getCurrentChapter() {
    if (!this.currentBook) return null;
    return this.currentBook.chapters[this.state.chapterIndex];
  }

  getCurrentBlock() {
    const chapter = this.getCurrentChapter();
    if (!chapter) return null;
    return chapter.blocks[this.state.blockId];
  }

  goToChapter(index) {
    this.state.chapterIndex = index;
    if (index > this.state.unlockedChapter) {
      this.state.unlockedChapter = index;
    }

    const matchingLoc = this.getLocations().find((loc) => loc.chapterIndex === index);
    if (matchingLoc) {
      this.state.locationId = matchingLoc.id;
      if (!this.state.visitedLocations.includes(matchingLoc.id)) {
        this.state.visitedLocations.push(matchingLoc.id);
      }
    }

    const chapter = this.getCurrentChapter();
    return this.moveToBlock(matchingLoc?.blockId || chapter.startBlock);
  }

  recordLog(chapterTitle, message) {
    const logEntry = `[${chapterTitle}] ${message}`;
    if (this.state.history[this.state.history.length - 1] !== logEntry) {
      this.state.history.push(logEntry);
    }
  }

  grantLootFromSource(source, shouldSave = false) {
    const chapterTitle = this.getCurrentChapter()?.title || 'Jornada';
    const rolledItems = LootSystem.collectSourceLoot(source);
    const added = [];

    for (const itemName of rolledItems) {
      const meta = LootSystem.getItemMetadata(itemName);
      const isUniqueQuestOrGear = meta?.type !== 'consumable' && this.state.inventory.includes(itemName);
      if (!isUniqueQuestOrGear) {
        this.state.inventory.push(itemName);
        added.push(itemName);
      }
    }

    if (added.length > 0) {
      this.recordLog(chapterTitle, `Saque obtido: ${added.join(', ')}.`);
    }

    if (shouldSave) {
      this.saveProgress();
    }

    return added;
  }

  useInventoryItem(itemIndex) {
    if (!Array.isArray(this.state.inventory)) return null;
    if (itemIndex < 0 || itemIndex >= this.state.inventory.length) return null;

    const itemName = this.state.inventory[itemIndex];
    const meta = LootSystem.getItemMetadata(itemName);
    if (!meta || meta.type !== 'consumable') {
      return null;
    }

    this.state.inventory.splice(itemIndex, 1);

    if (meta.statBoost) {
      this.applyStatChanges(meta.statBoost, false);
    }

    if (meta.fullHeal) {
      this.restoreFullHealth(itemName, false);
    } else if (meta.heal > 0) {
      this.applyHpChange(meta.heal, itemName, false);
    }

    const chapterTitle = this.getCurrentChapter()?.title || 'Jornada';
    this.recordLog(chapterTitle, `Você usou ${itemName}.`);
    this.saveProgress();

    return { itemName, meta };
  }

  syncHealth(healAmountOnLevelUp = 0, shouldSave = false) {
    const base = CombatSystem.syncMaxHp(
      this.state.health,
      this.state.stats,
      this.state.progression?.level ?? 1
    );
    const boostedHp = Math.min(base.maxHp, base.hp + healAmountOnLevelUp);
    this.state.health = {
      hp: boostedHp,
      maxHp: base.maxHp
    };
    if (shouldSave) {
      this.saveProgress();
    }
    return this.state.health;
  }

  applyHpChange(delta, reason = '', shouldSave = true) {
    const chapterTitle = this.getCurrentChapter()?.title || 'Jornada';
    const res = CombatSystem.modifyHp(
      this.state.health,
      delta,
      this.state.stats,
      this.state.progression?.level ?? 1
    );
    this.state.health = { hp: res.hp, maxHp: res.maxHp };

    if (res.actualChange < 0) {
      const lost = Math.abs(res.actualChange);
      const suffix = reason ? ` (${reason})` : '';
      this.recordLog(chapterTitle, `Você sofreu ${lost} de dano${suffix}. HP: ${res.hp}/${res.maxHp}.`);
    } else if (res.actualChange > 0) {
      const suffix = reason ? ` (${reason})` : '';
      this.recordLog(chapterTitle, `Você recuperou ${res.actualChange} de HP${suffix}. HP: ${res.hp}/${res.maxHp}.`);
    }

    if (shouldSave) {
      this.saveProgress();
    }

    return res;
  }

  restoreFullHealth(reason = 'Descanso', shouldSave = true) {
    const chapterTitle = this.getCurrentChapter()?.title || 'Jornada';
    this.state.health = CombatSystem.healFull(
      this.state.stats,
      this.state.progression?.level ?? 1
    );
    this.recordLog(
      chapterTitle,
      `Vida totalmente restaurada (${reason}). HP: ${this.state.health.hp}/${this.state.health.maxHp}.`
    );
    if (shouldSave) {
      this.saveProgress();
    }
    return this.state.health;
  }

  gainExperience(amount, shouldSave = true) {
    const chapterTitle = this.getCurrentChapter()?.title || 'Jornada';
    const result = ProgressionSystem.grantXp(this.state.progression, this.state.stats, amount);

    if (result.gained > 0) {
      this.recordLog(chapterTitle, `Você recebeu +${result.gained} de XP.`);
    }

    if (result.leveledUpCount > 0) {
      this.syncHealth(result.leveledUpCount * 10, false);
      this.recordLog(
        chapterTitle,
        `Subiu para o Nível ${result.newLevel}! (+${result.pointsAwarded} pontos de atributo e +${result.leveledUpCount * 10} de vitalidade)`
      );
    }

    if (shouldSave) {
      this.saveProgress();
    }

    return result;
  }

  spendStatPoint(statName, step = 5) {
    const allocated = ProgressionSystem.allocateStatPoint(
      this.state.progression,
      this.state.stats,
      statName,
      step
    );
    if (allocated) {
      this.syncHealth(0, false);
      this.saveProgress();
    }
    return allocated;
  }

  startCombat(enemyConfig, fallbackBlockId = null) {
    const enemy = CombatSystem.createEnemyState(enemyConfig);
    this.activeCombat = {
      enemy,
      sourceConfig: enemyConfig,
      turn: 1,
      fallbackBlockId: enemy.fleeBlock || fallbackBlockId || this.state.blockId,
      lastLog: `${enemy.name} entrou em combate!`
    };
    const chapterTitle = this.getCurrentChapter()?.title || 'Combate';
    this.recordLog(chapterTitle, `Combate iniciado contra ${enemy.name} (HP: ${enemy.hp}/${enemy.maxHp}).`);
    return this.activeCombat;
  }

  clearCombat() {
    this.activeCombat = null;
  }

  moveToBlock(blockId) {
    const chapter = this.getCurrentChapter();
    const block = chapter?.blocks[blockId];
    if (!block) return null;

    this.state.blockId = blockId;
    this.syncHealth(0, false);

    const matchingLoc = this.getLocations().find(
      (loc) => loc.chapterIndex === this.state.chapterIndex && loc.blockId === blockId
    );
    if (matchingLoc) {
      this.state.locationId = matchingLoc.id;
      if (!this.state.visitedLocations.includes(matchingLoc.id)) {
        this.state.visitedLocations.push(matchingLoc.id);
      }
    }

    this.grantLootFromSource(block, false);

    if (block.gainStats) {
      this.applyStatChanges(block.gainStats, false);
    }

    if (block.modifyStats) {
      this.applyStatChanges(block.modifyStats, false);
    }

    if (block.fullHeal) {
      this.restoreFullHealth('Bênção / Descanso', false);
    }

    const hpDelta = (block.heal ?? block.restoreHp ?? 0) - (block.damage ?? 0);
    if (hpDelta !== 0) {
      this.applyHpChange(hpDelta, '', false);
    }

    this.recordLog(chapter.title, block.content);

    const blockXp = block.giveXp ?? block.xp ?? 0;
    if (blockXp > 0) {
      this.gainExperience(blockXp, false);
    }

    if (block.enemy && this.state.health.hp > 0) {
      this.startCombat(block.enemy, blockId);
    }

    this.saveProgress();
    return block;
  }

  applyStatChanges(changesMap, shouldSave = true) {
    if (!changesMap || !this.state.stats) return;
    for (const [stat, value] of Object.entries(changesMap)) {
      if (this.state.stats[stat] !== undefined) {
        this.state.stats[stat] = Math.max(0, Math.min(100, this.state.stats[stat] + value));
      }
    }
    this.syncHealth(0, false);
    if (shouldSave) {
      this.saveProgress();
    }
  }

  saveProgress() {
    if (this.currentBook) {
      localStorage.setItem(SAVE_PREFIX + this.currentBook.id, JSON.stringify(this.state));
    }
  }

  restartGame() {
    if (!this.currentBook) return null;
    this.activeCombat = null;
    localStorage.removeItem(SAVE_PREFIX + this.currentBook.id);

    const startLoc = this.getLocations()[0] || null;
    const initialStats = this.buildInitialStats(this.currentBook);
    const initialProgression = ProgressionSystem.createInitialProgression();

    this.state = {
      chapterIndex: 0,
      unlockedChapter: 0,
      locationId: startLoc ? startLoc.id : null,
      visitedLocations: startLoc ? [startLoc.id] : [],
      blockId: startLoc?.blockId || this.currentBook.chapters[0].startBlock,
      inventory: [],
      stats: initialStats,
      health: CombatSystem.createInitialHealth(initialStats, initialProgression.level),
      progression: initialProgression,
      history: []
    };

    return this.moveToBlock(this.state.blockId);
  }

  getSuccessChance(stat, dc) {
    const statVal = this.state.stats[stat] ?? 50;
    return DiceSystem.calculateSuccessChance(statVal, dc);
  }

  performDiceCheck(stat, dc) {
    const statVal = this.state.stats[stat] ?? 50;
    return DiceSystem.rollCheck(statVal, dc);
  }
}