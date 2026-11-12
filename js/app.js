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

  // Atualiza contadores dos modais em segundo plano
  ui.renderInventoryModal(engine.state.inventory);

  ui.renderBlockContent(block, () => {
    ui.renderOptions(block.options, engine.state.inventory, engine, handleOptionSelect, handleRestart);
  });
}

function handleOptionSelect(option) {
  playSound('click');

  if (option.gainStats) {
    engine.applyStatGain(option.gainStats);
  }

  if (option.nextChapter !== undefined) {
    engine.goToChapter(option.nextChapter);
    loadCurrentBlock();
  } else if (option.diceRoll) {
    executeDiceCheck(option);
  } else {
    engine.moveToBlock(option.nextBlock);
    loadCurrentBlock();
  }
}

function executeDiceCheck(option) {
  const { stat, dc } = option.diceRoll;
  const statVal = engine.state.stats[stat] || 50;

  ui.showDiceModal(stat, dc, statVal);

  let ticks = 0;
  const maxTicks = 14;

  const rollInterval = setInterval(() => {
    const fakeRoll = Math.floor(Math.random() * 20) + 1;
    ui.updateDiceAnimation(fakeRoll);
    playSound('dice');
    ticks++;

    if (ticks >= maxTicks) {
      clearInterval(rollInterval);
      const result = engine.rollDice(stat, dc);

      if (result.success) {
        playSound('success');
      } else {
        playSound('fail');
      }

      ui.finalizeDiceAnimation(result, stat);

      ui.elements.diceContinueBtn.onclick = () => {
        playSound('click');
        ui.hideDiceModal();

        if (result.success && option.gainStats) {
          engine.applyStatGain(option.gainStats);
        }

        const nextBlockId = result.success ? option.nextBlock : option.failBlock;
        engine.moveToBlock(nextBlockId);
        loadCurrentBlock();
      };
    }
  }, 65);
}

function handleRestart() {
  engine.restartGame();
  loadCurrentBlock();
}

// Eventos de Digitação e Áudio
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

// Eventos dos Modais (Atributos, Mochila e Diário)
ui.elements.statsBtn.addEventListener('click', () => {
  playSound('click');
  ui.toggleModal('stats', true, engine.state.stats);
});
ui.elements.closeStatsBtn.addEventListener('click', () => {
  playSound('click');
  ui.toggleModal('stats', false);
});

ui.elements.inventoryBtn.addEventListener('click', () => {
  playSound('click');
  ui.toggleModal('inventory', true, engine.state.inventory);
});
ui.elements.closeInventoryBtn.addEventListener('click', () => {
  playSound('click');
  ui.toggleModal('inventory', false);
});

ui.elements.journalBtn.addEventListener('click', () => {
  playSound('click');
  ui.toggleModal('journal', true, engine.state.history);
});
ui.elements.closeJournalBtn.addEventListener('click', () => {
  playSound('click');
  ui.toggleModal('journal', false);
});

// Inicialização
init();