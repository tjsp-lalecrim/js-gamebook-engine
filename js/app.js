import { playSound, toggleAudio } from './audio.js';
import { CombatSystem } from './combat.js';
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

function handleUseInventoryItem(itemIndex) {
  const used = engine.useInventoryItem(itemIndex);
  if (used) {
    playSound('success');
    syncHud();
    ui.modals.renderInventory(engine.state.inventory, handleUseInventoryItem);
  }
}

function syncHud() {
  ui.renderHealthHud(engine.state.health);
  ui.modals.renderInventory(engine.state.inventory, handleUseInventoryItem);
  ui.renderStatsButtonBadge(engine.state.progression);
}

function openWorldMapModal() {
  const currentLoc = engine.getCurrentLocation();
  ui.modals.toggle(
    'map',
    true,
    {
      locations: engine.getLocations(),
      currentLocationId: currentLoc ? currentLoc.id : null,
      state: engine.state
    },
    (targetLocationId) => {
      playSound('click');
      const moved = engine.travelToLocation(targetLocationId);
      if (moved) {
        playSound('success');
        loadCurrentBlock();
      }
    }
  );
}

function handlePlayerDefeat() {
  const questTitle = engine.getCurrentQuest()?.title || 'Quest';
  const chapterTitle = engine.getCurrentChapter()?.title || 'Jornada';
  engine.recordLog(`${questTitle} • ${chapterTitle}`, 'Seus pontos de vida chegaram a 0. Você caiu em batalha.');
  engine.saveProgress();
  syncHud();

  ui.renderBlockContent(
    {
      image: 'https://picsum.photos/seed/gameover/650/300',
      content: 'Sua visão escurece e suas forças se esgotam em Tamriel. Sem pontos de vida para continuar, você pode reiniciar a campanha.',
      options: []
    },
    () => {
      ui.renderOptions([], engine.state.inventory, engine, handleOptionSelect, handleRestart);
    }
  );
}

function checkActiveCombatIfAny() {
  const combat = engine.activeCombat;
  if (!combat || !combat.enemy) return false;

  const finishCombat = (outcome) => {
    const enemy = combat.enemy;
    const sourceConfig = combat.sourceConfig || enemy;
    const questTitle = engine.getCurrentQuest()?.title || 'Quest';
    const chapterTitle = engine.getCurrentChapter()?.title || 'Combate';
    engine.clearCombat();

    if (outcome === 'defeat_player') {
      handlePlayerDefeat();
      return;
    }

    if (outcome === 'flee') {
      const targetBlock = enemy.fleeBlock || combat.fallbackBlockId || engine.state.blockId;
      engine.moveToBlock(targetBlock);
      loadCurrentBlock();
      return;
    }

    if (outcome === 'victory') {
      engine.recordLog(`${questTitle} • ${chapterTitle}`, `${enemy.name} foi derrotado!`);
      engine.grantLootFromSource(sourceConfig, false);
      if (enemy.xpReward > 0) {
        engine.gainExperience(enemy.xpReward, false);
      }
      const nextBlock = enemy.defeatBlock || engine.state.blockId;
      engine.moveToBlock(nextBlock);
      loadCurrentBlock();
    }
  };

  const runEnemyCounter = (prefixText = '') => {
    const enemy = combat.enemy;
    const atk = CombatSystem.resolveEnemyAttack(enemy, engine.state.stats);

    if (atk.hit) {
      playSound('fail');
      const hpRes = engine.applyHpChange(-atk.damage, atk.isCrit ? 'Acerto Crítico Inimigo' : enemy.name, false);
      const critTag = atk.isCrit ? ' CRÍTICO!' : '';
      combat.lastLog = `${prefixText}${enemy.name} acertou (1d20=${atk.d20}${atk.bonus >= 0 ? `+${atk.bonus}` : atk.bonus} vs Def ${atk.playerDefense})${critTag} e causou ${atk.damage} de dano!`;
      syncHud();

      if (hpRes.isDead) {
        combat.lastLog += ' Você caiu sem vida!';
        engine.saveProgress();
        ui.modals.updateCombatState(combat, engine.state.health, {
          isFinished: true,
          finishLabel: 'Encerrar Combate'
        });
        ui.modals.elements.combatFinishBtn.onclick = () => {
          ui.modals.hideCombatModal();
          finishCombat('defeat_player');
        };
        return true;
      }
    } else {
      playSound('click');
      combat.lastLog = `${prefixText}${enemy.name} errou o ataque (1d20=${atk.d20}${atk.bonus >= 0 ? `+${atk.bonus}` : atk.bonus} vs Def ${atk.playerDefense}).`;
    }

    combat.turn += 1;
    engine.saveProgress();
    return false;
  };

  const onAttack = () => {
    playSound('dice');
    const enemy = combat.enemy;
    const result = CombatSystem.resolvePlayerAttack(engine.state.stats, enemy, enemy.attackStat);

    let msg = '';
    if (result.hit) {
      playSound('success');
      enemy.hp = Math.max(0, enemy.hp - result.damage);
      const critNote = result.isCrit ? ' (CRÍTICO!)' : '';
      msg = `Você acertou (1d20=${result.d20}${result.modifier >= 0 ? `+${result.modifier}` : result.modifier} vs CD ${result.dc})${critNote} e causou ${result.damage} de dano! `;
    } else {
      playSound('fail');
      msg = `Você errou o golpe (1d20=${result.d20}${result.modifier >= 0 ? `+${result.modifier}` : result.modifier} vs CD ${result.dc}). `;
    }

    if (enemy.hp <= 0) {
      combat.lastLog = `${msg}${enemy.defeatText} (+${enemy.xpReward} XP)`;
      ui.modals.updateCombatState(combat, engine.state.health, {
        isFinished: true,
        finishLabel: 'Coletar Saque e Continuar →'
      });
      ui.modals.elements.combatFinishBtn.onclick = () => {
        ui.modals.hideCombatModal();
        finishCombat('victory');
      };
      return;
    }

    runEnemyCounter(msg);
    ui.modals.updateCombatState(combat, engine.state.health, { isFinished: false });
  };

  const onDodge = () => {
    playSound('dice');
    const enemy = combat.enemy;
    const dodge = CombatSystem.resolveDodgeAttempt(engine.state.stats, enemy);

    if (dodge.success) {
      playSound('success');
      let counterText = '';
      if (dodge.counterDamage > 0) {
        enemy.hp = Math.max(0, enemy.hp - dodge.counterDamage);
        counterText = ` Contra-ataque crítico causou ${dodge.counterDamage} de dano!`;
      }

      if (enemy.hp <= 0) {
        combat.lastLog = `Esquiva perfeita!${counterText} ${enemy.defeatText}`;
        ui.modals.updateCombatState(combat, engine.state.health, {
          isFinished: true,
          finishLabel: 'Coletar Saque e Continuar →'
        });
        ui.modals.elements.combatFinishBtn.onclick = () => {
          ui.modals.hideCombatModal();
          finishCombat('victory');
        };
        return;
      }

      combat.turn += 1;
      combat.lastLog = `Você esquivou do golpe de ${enemy.name} (1d20=${dodge.d20})!${counterText}`;
      engine.saveProgress();
      ui.modals.updateCombatState(combat, engine.state.health, { isFinished: false });
    } else {
      runEnemyCounter(`Esquiva falhou (1d20=${dodge.d20})! `);
      ui.modals.updateCombatState(combat, engine.state.health, { isFinished: false });
    }
  };

  const onFlee = () => {
    playSound('dice');
    const enemy = combat.enemy;
    const flee = CombatSystem.resolveFleeAttempt(engine.state.stats, enemy);

    if (flee.success) {
      playSound('success');
      combat.lastLog = `Você conseguiu escapar de ${enemy.name}!`;
      ui.modals.updateCombatState(combat, engine.state.health, {
        isFinished: true,
        finishLabel: 'Recuar em Segurança →'
      });
      ui.modals.elements.combatFinishBtn.onclick = () => {
        ui.modals.hideCombatModal();
        finishCombat('flee');
      };
    } else {
      runEnemyCounter(`Tentativa de fuga falhou (1d20=${flee.d20})! `);
      ui.modals.updateCombatState(combat, engine.state.health, { isFinished: false });
    }
  };

  ui.modals.openCombatModal(combat, engine.state.health, {
    onAttack,
    onDodge,
    onFlee,
    onFinish: () => finishCombat('victory')
  });
  return true;
}

function loadCurrentBlock() {
  const quest = engine.getCurrentQuest();
  const chapter = engine.getCurrentChapter();
  const block = engine.getCurrentBlock();
  if (!block || !chapter) return;

  const currentLoc = engine.getCurrentLocation();
  ui.renderHeader(engine.currentBook.title, quest?.title || '', chapter.title, currentLoc);

  ui.renderQuestNav(
    engine.getBookQuests(),
    engine.state.questIndex,
    engine.state.unlockedQuest,
    (qIdx) => {
      playSound('click');
      engine.goToQuest(qIdx);
      loadCurrentBlock();
    }
  );

  ui.renderChapterNav(
    engine.getQuestChapters(engine.state.questIndex),
    engine.state.chapterIndex,
    engine.state.unlockedChapter,
    (cIdx) => {
      playSound('click');
      engine.goToChapter(cIdx);
      loadCurrentBlock();
    }
  );

  syncHud();

  if (engine.state.health.hp <= 0 && !engine.activeCombat) {
    handlePlayerDefeat();
    return;
  }

  ui.renderBlockContent(block, () => {
    ui.renderOptions(block.options, engine.state.inventory, engine, handleOptionSelect, handleRestart);
    checkActiveCombatIfAny();
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

function applyOptionHealthEffects(option, shouldSave = false) {
  if (option.fullHeal) {
    engine.restoreFullHealth('Poção / Descanso', false);
  }
  const hpDelta = (option.heal ?? option.restoreHp ?? 0) - (option.damage ?? 0);
  if (hpDelta !== 0) {
    engine.applyHpChange(hpDelta, '', false);
  }
  if (shouldSave) {
    engine.saveProgress();
  }
}

function advanceAfterOption(option) {
  if (option.nextQuest !== undefined) {
    engine.goToQuest(option.nextQuest, option.nextChapter ?? null, option.nextBlock ?? null);
    loadCurrentBlock();
  } else if (option.nextChapter !== undefined) {
    engine.goToChapter(option.nextChapter, option.nextBlock ?? null);
    loadCurrentBlock();
  } else {
    engine.moveToBlock(option.nextBlock);
    loadCurrentBlock();
  }
}

function handleOptionSelect(option) {
  playSound('click');

  if (option.openMap) {
    openWorldMapModal();
    return;
  }

  if (option.gainStats) engine.applyStatChanges(option.gainStats, false);
  applyOptionHealthEffects(option, false);
  applyOptionXp(option, false);

  if (!option.diceRoll) {
    engine.grantLootFromSource(option, false);
  }

  if (engine.state.health.hp <= 0) {
    handlePlayerDefeat();
    return;
  }

  if (option.enemy) {
    engine.startCombat(option.enemy, option.nextBlock || engine.state.blockId);
    engine.saveProgress();
    syncHud();
    checkActiveCombatIfAny();
    return;
  }

  if (option.travelToLocation) {
    const moved = engine.travelToLocation(option.travelToLocation);
    if (moved) {
      loadCurrentBlock();
    }
    return;
  }

  if (option.diceRoll) {
    executeDiceCheck(option);
  } else {
    advanceAfterOption(option);
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
          engine.grantLootFromSource(option, false);
          applyOptionXp(option, false);
        } else if (option.failDamage > 0) {
          engine.applyHpChange(-option.failDamage, 'Falha no Teste', false);
        }

        if (engine.state.health.hp <= 0) {
          handlePlayerDefeat();
          return;
        }

        if (result.success) {
          advanceAfterOption(option);
        } else {
          engine.moveToBlock(option.failBlock);
          loadCurrentBlock();
        }
      });
    }
  }, 65);
}

function handleAllocateStat(statName) {
  const changed = engine.spendStatPoint(statName, 5);
  if (changed) {
    playSound('success');
    syncHud();
    ui.modals.renderStats({
      stats: engine.state.stats,
      progression: engine.state.progression,
      health: engine.state.health
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
    checkActiveCombatIfAny();
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
ui.elements.mapBtn.addEventListener('click', () => {
  playSound('click');
  openWorldMapModal();
});
ui.elements.closeMapBtn.addEventListener('click', () => {
  playSound('click');
  ui.modals.toggle('map', false);
});

ui.elements.statsBtn.addEventListener('click', () => {
  playSound('click');
  ui.modals.toggle('stats', true, {
    stats: engine.state.stats,
    progression: engine.state.progression,
    health: engine.state.health
  }, handleAllocateStat);
});
ui.elements.closeStatsBtn.addEventListener('click', () => {
  playSound('click');
  ui.modals.toggle('stats', false);
});

ui.elements.inventoryBtn.addEventListener('click', () => {
  playSound('click');
  ui.modals.toggle('inventory', true, engine.state.inventory, handleUseInventoryItem);
});
ui.elements.closeInventoryBtn.addEventListener('click', () => {
  playSound('click');
  ui.modals.toggle('inventory', false);
});

ui.elements.journalBtn.addEventListener('click', () => {
  playSound('click');
  ui.modals.toggle('journal', true, {
    history: engine.state.history,
    quests: engine.getBookQuests()
  });
});
ui.elements.closeJournalBtn.addEventListener('click', () => {
  playSound('click');
  ui.modals.toggle('journal', false);
});


// Inicialização
init();