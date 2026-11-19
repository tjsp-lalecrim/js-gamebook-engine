import { playSound, toggleAudio } from './audio.js';
import { GameEngine } from './engine.js';
import { UIManager } from './ui.js';

const engine = new GameEngine();
const ui = new UIManager();

async function init() {
  try {
    const { books } = await engine.loadGameData();
    ui.renderLibraryList(books, (book) => {
      playSound('click');
      startBook(book);
    });
  } catch (error) {
    console.error('Erro ao inicializar o jogo:', error);
  }
}

function startBook(book) {
  engine.openBook(book);
  ui.showGame();
  loadCurrentBlock();
}

function syncHudBadges() {
  ui.modals.renderInventory(engine.state.inventory);
  ui.renderStatsButtonBadge(engine.state.progression);
}

function loadCurrentBlock() {
  const chapter = engine.getCurrentChapter();
  const block = engine.getCurrentBlock();
  if (!block) return;

  ui.renderHeader(engine.currentBook.title, chapter.title);
  ui.renderChapterNav(
    engine.currentBook.chapters,
    engine.state.chapterIndex,
    engine.state.unlockedChapter,
    (idx) => {
      playSound('click');
      engine.goToChapter(idx);
      loadCurrentBlock();
    }
  );

  syncHudBadges();

  ui.renderBlockContent(block, () => {
    ui.renderOptions(block.options, engine.state.inventory, engine, handleOptionSelect, handleRestart);
  });
}

function applyOptionXp(option, shouldSave = true) {
  const xpAmount = option.gainXp ?? option.xp ?? 0;
  if (xpAmount > 0) {
    const res = engine.gainExperience(xpAmount, shouldSave);
    if (res.leveledUpCount > 0) {
      playSound('success');
    }
  }
}

function handleOptionSelect(option) {
  playSound('click');

  if (option.nextChapter !== undefined) {
    if (option.gainStats) engine.applyStatChanges(option.gainStats, false);
    applyOptionXp(option, false);
    engine.goToChapter(option.nextChapter);
    loadCurrentBlock();
  } else if (option.diceRoll) {
    executeDiceCheck(option);
  } else {
    if (option.gainStats) engine.applyStatChanges(option.gainStats, false);
    applyOptionXp(option, false);
    engine.moveToBlock(option.nextBlock);
    loadCurrentBlock();
  }
}

function executeDiceCheck(option) {
  const { stat, dc } = option.diceRoll;
  const statVal = engine.state.stats[stat] ?? 50;

  ui.modals.showDiceCheck(stat, dc, statVal);

  let ticks = 0;
  const maxTicks = 14;

  const rollInterval = setInterval(() => {
    const fakeRoll = Math.floor(Math.random() * 20) + 1;
    ui.modals.updateDiceRoll(fakeRoll);
    playSound('dice');
    ticks++;

    if (ticks >= maxTicks) {
      clearInterval(rollInterval);
      const result = engine.performDiceCheck(stat, dc);

      playSound(result.success ? 'success' : 'fail');

      ui.modals.finalizeDiceCheck(result, () => {
        playSound('click');

        if (result.success) {
          if (option.gainStats) {
            engine.applyStatChanges(option.gainStats, false);
          }
          applyOptionXp(option, false);
        }

        const nextBlockId = result.success ? option.nextBlock : option.failBlock;
        engine.moveToBlock(nextBlockId);
        loadCurrentBlock();
      });
    }
  }, 65);
}

function handleAllocateStat(statName) {
  const changed = engine.spendStatPoint(statName, 5);
  if (changed) {
    playSound('success');
    syncHudBadges();
    ui.modals.renderStats({
      stats: engine.state.stats,
      progression: engine.state.progression
    }, handleAllocateStat);
  }
}

function handleRestart() {
  engine.restartGame();
  loadCurrentBlock();
}

// Eventos de Digitação e Controles Gerais
ui.elements.text.addEventListener('click', () => {
  if (ui.skipTypewriter()) {
    const block = engine.getCurrentBlock();
    ui.renderOptions(block.options, engine.state.inventory, engine, handleOptionSelect, handleRestart);
  }
});

ui.elements.audioToggleBtn.addEventListener('click', () => {
  const enabled = toggleAudio();
  ui.setAudioButtonText(enabled);
});

ui.elements.resetBtn.addEventListener('click', () => {
  playSound('click');
  handleRestart();
});

ui.elements.backBtn.addEventListener('click', () => {
  playSound('click');
  ui.showLibrary();
});

// Eventos dos Modais
ui.elements.statsBtn.addEventListener('click', () => {
  playSound('click');
  ui.modals.toggle('stats', true, {
    stats: engine.state.stats,
    progression: engine.state.progression
  }, handleAllocateStat);
});
ui.elements.closeStatsBtn.addEventListener('click', () => {
  playSound('click');
  ui.modals.toggle('stats', false);
});

ui.elements.inventoryBtn.addEventListener('click', () => {
  playSound('click');
  ui.modals.toggle('inventory', true, engine.state.inventory);
});
ui.elements.closeInventoryBtn.addEventListener('click', () => {
  playSound('click');
  ui.modals.toggle('inventory', false);
});

ui.elements.journalBtn.addEventListener('click', () => {
  playSound('click');
  ui.modals.toggle('journal', true, engine.state.history);
});
ui.elements.closeJournalBtn.addEventListener('click', () => {
  playSound('click');
  ui.modals.toggle('journal', false);
});

// Inicialização
init();