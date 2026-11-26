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
  }

  createEmptyState() {
    const initialStats = {};
    const initialProgression = ProgressionSystem.createInitialProgression();
    return {
      questIndex: 0,
      unlockedQuest: 0,
      chapterIndex: 0,
      unlockedChapter: 0,
      unlockedChapters: {},
      visitedBlocks: [],
      rewardedCombats: [],
      activeCombat: null,
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

  get activeCombat() {
    return this.state.activeCombat;
  }

  set activeCombat(combat) {
    this.state.activeCombat = combat;
  }

  getUnlockedChapter(questIndex) {
    return this.state.unlockedChapters[questIndex] ?? (this.getBookQuests()[questIndex]?.startChapter ?? 0);
  }

  unlockChapter(questIndex, chapterIndex) {
    const unlocked = Math.max(chapterIndex, this.getUnlockedChapter(questIndex));
    this.state.unlockedChapters[questIndex] = unlocked;
    this.state.unlockedChapter = unlocked;
  }

  normalizeHistoryEntries(rawHistory) {
    if (!Array.isArray(rawHistory)) return [];
    const fallbackQuest = this.getCurrentQuest()?.title || 'Quest I';

    return rawHistory.map((entry) => {
      if (typeof entry === 'string') {
        const match = entry.match(/^\[([^\]]+)\]\s*(.*)$/);
        if (match) {
          const prefix = match[1];
          const msg = match[2] || '';
          const parts = prefix.split('•').map((p) => p.trim());
          const questTitle = parts.length > 1 ? parts[0] : fallbackQuest;
          const chapterTitle = parts.length > 1 ? parts.slice(1).join(' • ') : prefix;
          return {
            questTitle,
            chapterTitle,
            message: msg,
            text: `[${chapterTitle}] ${msg}`
          };
        }
        return {
          questTitle: fallbackQuest,
          chapterTitle: 'Jornada',
          message: entry,
          text: entry
        };
      }

      const questTitle = entry?.questTitle || fallbackQuest;
      const chapterTitle = entry?.chapterTitle || 'Jornada';
      const message = entry?.message ?? entry?.text ?? '';
      return {
        questTitle,
        chapterTitle,
        message,
        text: entry?.text || `[${chapterTitle}] ${message}`
      };
    });
  }

  getBookQuests(book = this.currentBook) {
    if (!book) return [];
    if (Array.isArray(book.quests) && book.quests.length > 0) {
      return book.quests;
    }
    if (Array.isArray(book.chapters) && book.chapters.length > 0) {
      return [
        {
          id: `${book.id || 'book'}-quest-1`,
          title: book.title || 'Campanha Principal',
          description: book.description || '',
          startChapter: 0,
          chapters: book.chapters
        }
      ];
    }
    return [];
  }

  getQuestChapters(questIndex = this.state.questIndex) {
    const quests = this.getBookQuests();
    const quest = quests[questIndex] || quests[0];
    return Array.isArray(quest?.chapters) ? quest.chapters : [];
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

    const quests = this.getBookQuests(this.currentBook);
    const maxQuestIdx = Math.max(0, quests.length - 1);
    const questIndex = Math.max(0, Math.min(maxQuestIdx, savedState?.questIndex ?? 0));
    const unlockedQuest = Math.max(questIndex, Math.min(maxQuestIdx, savedState?.unlockedQuest ?? questIndex));

    const chapters = this.getQuestChapters(questIndex);
    const maxChapIdx = Math.max(0, chapters.length - 1);
    const chapterIndex = Math.max(0, Math.min(maxChapIdx, savedState?.chapterIndex ?? 0));
    const visitedLocations = Array.isArray(savedState?.visitedLocations) ? savedState.visitedLocations : [];
    const history = this.normalizeHistoryEntries(savedState?.history);
    const unlockedChapters = { ...savedState?.unlockedChapters };
    for (const location of this.getLocations()) {
      if (visitedLocations.includes(location.id)) {
        const qIdx = location.questIndex ?? 0;
        unlockedChapters[qIdx] = Math.max(unlockedChapters[qIdx] ?? 0, location.chapterIndex ?? 0);
      }
    }
    if (!savedState?.unlockedChapters && quests.length === 1) {
      unlockedChapters[questIndex] = savedState?.unlockedChapter;
    }
    const unlockedChapter = Math.max(chapterIndex, Math.min(maxChapIdx, unlockedChapters[questIndex] ?? chapterIndex));
    unlockedChapters[questIndex] = unlockedChapter;
    const visitedBlocks = Array.isArray(savedState?.visitedBlocks) ? savedState.visitedBlocks : [];
    if (!Array.isArray(savedState?.visitedBlocks)) {
      for (const [qIdx, quest] of quests.entries()) {
        for (const [cIdx, chapter] of (quest.chapters || []).entries()) {
          for (const [blockId, block] of Object.entries(chapter.blocks || {})) {
            if (history.some(entry => entry.questTitle === quest.title && entry.chapterTitle === chapter.title && entry.message === block.content)) {
              visitedBlocks.push(JSON.stringify([qIdx, cIdx, blockId]));
            }
          }
        }
      }
      if (savedState?.blockId) {
        visitedBlocks.push(JSON.stringify([questIndex, chapterIndex, savedState.blockId]));
      }
    }

    const normalized = {
      ...base,
      ...savedState,
      questIndex,
      unlockedQuest,
      chapterIndex,
      unlockedChapter,
      unlockedChapters,
      visitedBlocks,
      visitedLocations,
      inventory: Array.isArray(savedState?.inventory) ? savedState.inventory : [],
      stats,
      health,
      progression: mergedProgression,
      history
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
      const [booksRes, statsRes, itemsRes] = await Promise.all([
        fetch('./data/Books.json'),
        fetch('./data/Stats.json'),
        fetch('./data/Items.json').catch(() => null)
      ]);

      if (!booksRes.ok || !statsRes.ok) {
        throw new Error('Falha ao carregar os arquivos JSON de dados.');
      }

      this.allBooks = await booksRes.json();
      const statsData = await statsRes.json();
      this.defaultStats = statsData.defaultStats || {};

      if (itemsRes?.ok) LootSystem.setCatalogFromData(await itemsRes.json());

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
    const savedData = localStorage.getItem(SAVE_PREFIX + book.id);

    if (savedData) {
      const savedState = JSON.parse(savedData);
      this.state = this.normalizeLoadedState(savedState);
      const block = this.getCurrentBlock();
      if (!Object.prototype.hasOwnProperty.call(savedState, 'activeCombat') && block?.enemy && this.state.health.hp > 0) {
        this.startCombat(block.enemy, this.state.blockId);
        this.saveProgress();
      }
      return this.state;
    }

    this.initializeBookState();
    return this.state;
  }

  initializeBookState() {
    const book = this.currentBook;
    const quests = this.getBookQuests(book);
    const firstQuest = quests[0] || {};
    const firstChapIdx = firstQuest.startChapter ?? 0;
    const firstChapter = (firstQuest.chapters || [])[firstChapIdx] || (firstQuest.chapters || [])[0];
    const startLoc = WorldMapSystem.getBookLocations(book)[0] || null;
    const initialStats = this.buildInitialStats(book);
    const initialProgression = ProgressionSystem.createInitialProgression();

    this.state = {
      ...this.createEmptyState(),
      questIndex: 0,
      unlockedQuest: 0,
      chapterIndex: firstChapIdx,
      unlockedChapter: firstChapIdx,
      unlockedChapters: { 0: firstChapIdx },
      locationId: startLoc ? startLoc.id : null,
      visitedLocations: startLoc ? [startLoc.id] : [],
      blockId: firstChapter?.startBlock || startLoc?.blockId,
      inventory: [],
      stats: initialStats,
      health: CombatSystem.createInitialHealth(initialStats, initialProgression.level),
      progression: initialProgression,
      history: []
    };

    return this.moveToBlock(this.state.blockId);
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

    const quests = this.getBookQuests();
    const targetQuestIdx = location.questIndex ?? this.state.questIndex;
    const quest = quests[targetQuestIdx];
    if (!quest) return null;

    const chapters = quest.chapters || [];
    const targetChapterIdx = location.chapterIndex ?? (quest.startChapter ?? 0);
    const chapter = chapters[targetChapterIdx];
    if (!chapter) return null;

    const targetBlockId = location.blockId || chapter.startBlock;
    if (!chapter.blocks?.[targetBlockId]) return null;

    this.state.questIndex = targetQuestIdx;
    if (targetQuestIdx > this.state.unlockedQuest) {
      this.state.unlockedQuest = targetQuestIdx;
    }

    this.state.chapterIndex = targetChapterIdx;
    this.unlockChapter(targetQuestIdx, targetChapterIdx);

    this.state.locationId = location.id;
    if (!this.state.visitedLocations.includes(location.id)) {
      this.state.visitedLocations.push(location.id);
    }

    this.recordLog(
      chapter.title,
      `Você viajou para ${location.name} (${location.region}).`,
      quest.title
    );
    return this.moveToBlock(targetBlockId);
  }

  getCurrentQuest() {
    const quests = this.getBookQuests();
    return quests[this.state.questIndex] || null;
  }

  getCurrentChapter() {
    const chapters = this.getQuestChapters(this.state.questIndex);
    return chapters[this.state.chapterIndex] || null;
  }

  getCurrentBlock() {
    const chapter = this.getCurrentChapter();
    if (!chapter) return null;
    return chapter.blocks?.[this.state.blockId] || null;
  }

  goToQuest(questIdx, chapterIdx = null, blockId = null) {
    const quests = this.getBookQuests();
    const quest = quests[questIdx];
    if (!quest) return null;

    const chapters = quest.chapters || [];
    const targetChapIdx = chapterIdx !== null ? chapterIdx : (quest.startChapter ?? 0);
    const chapter = chapters[targetChapIdx];
    const targetBlockId = blockId || chapter?.startBlock;
    if (!chapter?.blocks?.[targetBlockId]) return null;

    this.state.questIndex = questIdx;
    this.state.unlockedQuest = Math.max(questIdx, this.state.unlockedQuest);
    this.state.chapterIndex = targetChapIdx;
    this.unlockChapter(questIdx, targetChapIdx);
    this.state.locationId = null;
    this.recordLog(chapter.title, `Quest iniciada: ${quest.title}.`, quest.title);
    return this.moveToBlock(targetBlockId);
  }

  goToChapter(index, blockId = null) {
    const chapters = this.getQuestChapters(this.state.questIndex);
    const chapter = chapters[index];
    if (!chapter) return null;

    const matchingLoc = this.getLocations().find(
      (loc) => (loc.questIndex ?? 0) === this.state.questIndex && loc.chapterIndex === index
    );
    const targetBlockId = blockId || matchingLoc?.blockId || chapter.startBlock;
    if (!chapter.blocks?.[targetBlockId]) return null;

    this.state.chapterIndex = index;
    this.unlockChapter(this.state.questIndex, index);
    this.state.locationId = null;
    if (matchingLoc) {
      this.state.locationId = matchingLoc.id;
      if (!this.state.visitedLocations.includes(matchingLoc.id)) {
        this.state.visitedLocations.push(matchingLoc.id);
      }
    }

    return this.moveToBlock(targetBlockId);
  }

  recordLog(chapterTitle, message, questTitle = null) {
    const resolvedQuest = questTitle || this.getCurrentQuest()?.title || 'Quest';
    const resolvedChapter = chapterTitle || this.getCurrentChapter()?.title || 'Jornada';
    const formattedText = `[${resolvedChapter}] ${message}`;
    const lastEntry = this.state.history[this.state.history.length - 1];

    const newEntry = {
      questTitle: resolvedQuest,
      chapterTitle: resolvedChapter,
      message,
      text: formattedText
    };

    const lastText = typeof lastEntry === 'string' ? lastEntry : lastEntry?.text;
    const lastQuest = typeof lastEntry === 'string' ? null : lastEntry?.questTitle;

    if (lastText !== formattedText || lastQuest !== resolvedQuest) {
      this.state.history.push(newEntry);
    }
  }

  grantLootFromSource(source, shouldSave = false) {
    const questTitle = this.getCurrentQuest()?.title || 'Quest';
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
      this.recordLog(chapterTitle, `Saque obtido: ${added.join(', ')}.`, questTitle);
    }

    if (shouldSave) {
      this.saveProgress();
    }

    return added;
  }

  useInventoryItem(itemIndex) {
    if (this.state.health.hp <= 0) return null;
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

    const questTitle = this.getCurrentQuest()?.title || 'Quest';
    const chapterTitle = this.getCurrentChapter()?.title || 'Jornada';
    this.recordLog(chapterTitle, `Você usou ${itemName}.`, questTitle);
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
    const questTitle = this.getCurrentQuest()?.title || 'Quest';
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
      this.recordLog(chapterTitle, `Você sofreu ${lost} de dano${suffix}. HP: ${res.hp}/${res.maxHp}.`, questTitle);
    } else if (res.actualChange > 0) {
      const suffix = reason ? ` (${reason})` : '';
      this.recordLog(chapterTitle, `Você recuperou ${res.actualChange} de HP${suffix}. HP: ${res.hp}/${res.maxHp}.`, questTitle);
    }

    if (shouldSave) {
      this.saveProgress();
    }

    return res;
  }

  restoreFullHealth(reason = 'Descanso', shouldSave = true) {
    const questTitle = this.getCurrentQuest()?.title || 'Quest';
    const chapterTitle = this.getCurrentChapter()?.title || 'Jornada';
    this.state.health = CombatSystem.healFull(
      this.state.stats,
      this.state.progression?.level ?? 1
    );
    this.recordLog(
      chapterTitle,
      `Vida totalmente restaurada (${reason}). HP: ${this.state.health.hp}/${this.state.health.maxHp}.`,
      questTitle
    );
    if (shouldSave) {
      this.saveProgress();
    }
    return this.state.health;
  }

  gainExperience(amount, shouldSave = true) {
    const questTitle = this.getCurrentQuest()?.title || 'Quest';
    const chapterTitle = this.getCurrentChapter()?.title || 'Jornada';
    const result = ProgressionSystem.grantXp(this.state.progression, this.state.stats, amount);

    if (result.gained > 0) {
      this.recordLog(chapterTitle, `Você recebeu +${result.gained} de XP.`, questTitle);
    }

    if (result.leveledUpCount > 0) {
      this.syncHealth(result.leveledUpCount * 10, false);
      this.recordLog(
        chapterTitle,
        `Subiu para o Nível ${result.newLevel}! (+${result.pointsAwarded} pontos de atributo e +${result.leveledUpCount * 10} de vitalidade)`,
        questTitle
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

  applyOptionEffects(option, success = true) {
    if (!success) {
      if (option.failDamage > 0) this.applyHpChange(-option.failDamage, 'Falha no Teste', false);
      return;
    }

    if (option.gainStats) this.applyStatChanges(option.gainStats, false);
    if (option.fullHeal) this.restoreFullHealth('Poção / Descanso', false);
    const hpDelta = (option.heal ?? option.restoreHp ?? 0) - (option.damage ?? 0);
    if (hpDelta !== 0) this.applyHpChange(hpDelta, '', false);
    if (this.state.health.hp <= 0) return;
    this.grantLootFromSource(option, false);
    return this.gainExperience(option.gainXp ?? option.xp ?? 0, false);
  }

  startCombat(enemyConfig, fallbackBlockId = null) {
    const enemy = CombatSystem.createEnemyState(enemyConfig);
    this.activeCombat = {
      enemy,
      sourceConfig: enemyConfig,
      outcome: null,
      turn: 1,
      fallbackBlockId: enemy.fleeBlock || fallbackBlockId || this.state.blockId,
      lastLog: `${enemy.name} entrou em combate!`
    };
    const questTitle = this.getCurrentQuest()?.title || 'Quest';
    const chapterTitle = this.getCurrentChapter()?.title || 'Combate';
    this.recordLog(
      chapterTitle,
      `Combate iniciado contra ${enemy.name} (HP: ${enemy.hp}/${enemy.maxHp}).`,
      questTitle
    );
    return this.activeCombat;
  }

  setCombatOutcome(outcome) {
    if (!this.activeCombat || this.activeCombat.outcome) return;
    this.activeCombat.outcome = outcome;
    this.saveProgress();
  }

  finishCombat() {
    const combat = this.activeCombat;
    if (!combat?.outcome) return null;
    const { enemy, sourceConfig, outcome } = combat;
    this.activeCombat = null;

    if (outcome === 'victory') {
      const rewardKey = JSON.stringify([this.state.questIndex, this.state.chapterIndex, this.state.blockId, enemy.id]);
      this.recordLog(this.getCurrentChapter()?.title, `${enemy.name} foi derrotado!`);
      if (!this.state.rewardedCombats.includes(rewardKey)) {
        this.state.rewardedCombats.push(rewardKey);
        this.grantLootFromSource(sourceConfig, false);
        this.gainExperience(enemy.xpReward, false);
      }
      if (enemy.defeatBlock && enemy.defeatBlock !== this.state.blockId && this.moveToBlock(enemy.defeatBlock)) {
        return outcome;
      }
    } else if (outcome === 'flee') {
      const target = enemy.fleeBlock || combat.fallbackBlockId;
      const destination = enemy.fleeChapter != null
        ? this.goToChapter(enemy.fleeChapter, target)
        : target && target !== this.state.blockId && this.moveToBlock(target);
      if (destination) return outcome;
    }
    this.saveProgress();
    return outcome;
  }

  moveToBlock(blockId) {
    const quest = this.getCurrentQuest();
    const chapter = this.getCurrentChapter();
    const block = chapter?.blocks?.[blockId];
    if (!block) return null;

    this.state.blockId = blockId;
    this.syncHealth(0, false);

    const matchingLoc = this.getLocations().find(
      (loc) =>
        (loc.questIndex ?? 0) === this.state.questIndex &&
        loc.chapterIndex === this.state.chapterIndex &&
        loc.blockId === blockId
    );
    if (matchingLoc) {
      this.state.locationId = matchingLoc.id;
      if (!this.state.visitedLocations.includes(matchingLoc.id)) {
        this.state.visitedLocations.push(matchingLoc.id);
      }
    }

    const visitKey = JSON.stringify([this.state.questIndex, this.state.chapterIndex, blockId]);
    const firstVisit = !this.state.visitedBlocks.includes(visitKey);
    if (firstVisit) this.state.visitedBlocks.push(visitKey);
    if (firstVisit || block.repeatRewards) this.grantLootFromSource(block, false);

    if ((firstVisit || block.repeatRewards) && block.gainStats) {
      this.applyStatChanges(block.gainStats, false);
    }

    if ((firstVisit || block.repeatRewards) && block.modifyStats) {
      this.applyStatChanges(block.modifyStats, false);
    }

    if (block.fullHeal) {
      this.restoreFullHealth('Bênção / Descanso', false);
    }

    const hpDelta = (block.heal ?? block.restoreHp ?? 0) - (block.damage ?? 0);
    if (hpDelta !== 0) {
      this.applyHpChange(hpDelta, '', false);
    }

    this.recordLog(chapter.title, block.content, quest?.title || 'Quest');

    const blockXp = block.giveXp ?? block.xp ?? 0;
    if ((firstVisit || block.repeatRewards) && blockXp > 0) {
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
    return this.initializeBookState();
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
