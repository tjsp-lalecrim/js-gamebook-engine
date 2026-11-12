const SAVE_PREFIX = 'livro_jogo_cap_save_';

export class GameEngine {
  constructor() {
    this.allBooks = [];
    this.defaultStats = {};
    this.currentBook = null;
    this.state = {
      chapterIndex: 0,
      unlockedChapter: 0,
      blockId: null,
      inventory: [],
      stats: {},
      history: []
    };
  }

  // Carrega tanto os livros quanto os atributos padrão do Stats.json
  async loadGameData() {
    try {
      const [booksRes, statsRes] = await Promise.all([
        fetch('./data/books.json'),
        fetch('./data/Stats.json')
      ]);

      this.allBooks = await booksRes.json();
      const statsData = await statsRes.json();
      this.defaultStats = statsData.defaultStats || {};

      return { books: this.allBooks, stats: this.defaultStats };
    } catch (error) {
      console.error('Erro ao carregar dados do jogo:', error);
      throw error;
    }
  }

  openBook(book) {
    this.currentBook = book;
    const savedData = localStorage.getItem(SAVE_PREFIX + book.id);

    if (savedData) {
      this.state = JSON.parse(savedData);
    } else {
      // Usa os atributos padrão vindos do Stats.json
      this.state = {
        chapterIndex: 0,
        unlockedChapter: 0,
        blockId: book.chapters[0].startBlock,
        inventory: [],
        stats: { ...this.defaultStats },
        history: []
      };
    }
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

  moveToBlock(blockId) {
    const chapter = this.getCurrentChapter();
    const block = chapter.blocks[blockId];
    if (!block) return;

    this.state.blockId = blockId;

    if (block.giveItem && !this.state.inventory.includes(block.giveItem)) {
      this.state.inventory.push(block.giveItem);
    }

    if (block.gainStats) {
      this.applyStatGain(block.gainStats);
    }

    if (block.modifyStats) {
      if (!this.state.stats) this.state.stats = {};
      for (const [stat, value] of Object.entries(block.modifyStats)) {
        if (this.state.stats[stat] !== undefined) {
          this.state.stats[stat] += value;
        }
      }
    }

    const logEntry = `[${chapter.title}] ${block.content}`;
    if (this.state.history[this.state.history.length - 1] !== logEntry) {
      this.state.history.push(logEntry);
    }

    this.saveProgress();
    return block;
  }

  applyStatGain(gainMap) {
    if (!gainMap || !this.state.stats) return;
    for (const [stat, value] of Object.entries(gainMap)) {
      if (this.state.stats[stat] !== undefined) {
        this.state.stats[stat] += value;
      }
    }
    this.saveProgress();
  }

  saveProgress() {
    if (this.currentBook) {
      localStorage.setItem(SAVE_PREFIX + this.currentBook.id, JSON.stringify(this.state));
    }
  }

  restartGame() {
    if (!this.currentBook) return;
    localStorage.removeItem(SAVE_PREFIX + this.currentBook.id);
    this.state = {
      chapterIndex: 0,
      unlockedChapter: 0,
      blockId: this.currentBook.chapters[0].startBlock,
      inventory: [],
      stats: { ...this.defaultStats },
      history: []
    };
    return this.moveToBlock(this.state.blockId);
  }

  calculateSuccessChance(statValue, dc) {
    // Como os atributos agora estão na faixa de 0 a 100, ajustamos a fórmula de cálculo de chance
    const estimatedRoll = statValue + 10; // Média estimada (1d20 + modificador)
    const diff = estimatedRoll - dc;
    let chance = 50 + (diff * 5);
    return Math.max(5, Math.min(95, Math.round(chance)));
  }

  rollDice(stat, dc) {
    const statVal = this.state.stats[stat] || 50;
    // Modificador baseado no atributo (ex: a cada 10 pontos acima de 50, ganha +1 no dado)
    const modifier = Math.floor((statVal - 50) / 5); 

    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + modifier;

    let isSuccess = total >= dc;
    if (d20 === 20) isSuccess = true;
    if (d20 === 1) isSuccess = false;

    return { d20, statVal: modifier, total, success: isSuccess };
  }
}