import { DiceSystem } from './dice.js';
import { ProgressionSystem } from './progression.js';

const SAVE_PREFIX = 'livro_jogo_cap_save_';

export class GameEngine {
  constructor() {
    this.allBooks = [];
    this.defaultStats = {};
    this.currentBook = null;
    this.state = this.createEmptyState();
  }

  createEmptyState() {
    return {
      chapterIndex: 0,
      unlockedChapter: 0,
      blockId: null,
      inventory: [],
      stats: {},
      progression: ProgressionSystem.createInitialProgression(),
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

    return {
      ...base,
      ...savedState,
      inventory: Array.isArray(savedState?.inventory) ? savedState.inventory : [],
      stats: savedState?.stats || {},
      progression: mergedProgression,
      history: Array.isArray(savedState?.history) ? savedState.history : []
    };
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
    const savedData = localStorage.getItem(SAVE_PREFIX + book.id);

    if (savedData) {
      this.state = this.normalizeLoadedState(JSON.parse(savedData));
      return this.state;
    }

    this.state = {
      chapterIndex: 0,
      unlockedChapter: 0,
      blockId: book.chapters[0].startBlock,
      inventory: [],
      stats: this.buildInitialStats(book),
      progression: ProgressionSystem.createInitialProgression(),
      history: []
    };

    this.moveToBlock(this.state.blockId);
    return this.state;
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
    const chapter = this.getCurrentChapter();
    return this.moveToBlock(chapter.startBlock);
  }

  recordLog(chapterTitle, message) {
    const logEntry = `[${chapterTitle}] ${message}`;
    if (this.state.history[this.state.history.length - 1] !== logEntry) {
      this.state.history.push(logEntry);
    }
  }

  gainExperience(amount, shouldSave = true) {
    const chapterTitle = this.getCurrentChapter()?.title || 'Jornada';
    const result = ProgressionSystem.grantXp(this.state.progression, this.state.stats, amount);

    if (result.gained > 0) {
      this.recordLog(chapterTitle, `Você recebeu +${result.gained} de XP.`);
    }

    if (result.leveledUpCount > 0) {
      this.recordLog(
        chapterTitle,
        `Subiu para o Nível ${result.newLevel}! (+${result.pointsAwarded} pontos de atributo disponíveis)`
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
      this.saveProgress();
    }
    return allocated;
  }

  moveToBlock(blockId) {
    const chapter = this.getCurrentChapter();
    const block = chapter?.blocks[blockId];
    if (!block) return null;

    this.state.blockId = blockId;

    if (block.giveItem && !this.state.inventory.includes(block.giveItem)) {
      this.state.inventory.push(block.giveItem);
    }

    if (block.gainStats) {
      this.applyStatChanges(block.gainStats, false);
    }

    if (block.modifyStats) {
      this.applyStatChanges(block.modifyStats, false);
    }

    this.recordLog(chapter.title, block.content);

    const blockXp = block.giveXp ?? block.xp ?? 0;
    if (blockXp > 0) {
      this.gainExperience(blockXp, false);
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
    localStorage.removeItem(SAVE_PREFIX + this.currentBook.id);

    this.state = {
      chapterIndex: 0,
      unlockedChapter: 0,
      blockId: this.currentBook.chapters[0].startBlock,
      inventory: [],
      stats: this.buildInitialStats(this.currentBook),
      progression: ProgressionSystem.createInitialProgression(),
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