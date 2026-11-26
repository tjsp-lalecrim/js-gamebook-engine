import { DiceSystem } from './dice.js';
import { LootSystem } from './loot.js';
import { WorldMapSystem } from './world.js';

export class ModalManager {
  constructor() {
    this.elements = {
      combatModal: document.getElementById('combat-modal'),
      combatEnemyName: document.getElementById('combat-enemy-name'),
      combatEnemyLabel: document.getElementById('combat-enemy-label'),
      combatTurnLabel: document.getElementById('combat-turn-label'),
      combatPlayerHpPill: document.getElementById('combat-player-hp-pill'),
      combatEnemyHpText: document.getElementById('combat-enemy-hp-text'),
      combatEnemyHpFill: document.getElementById('combat-enemy-hp-fill'),
      combatLogBox: document.getElementById('combat-log-box'),
      combatActions: document.getElementById('combat-actions'),
      combatAttackBtn: document.getElementById('combat-attack-btn'),
      combatDodgeBtn: document.getElementById('combat-dodge-btn'),
      combatFleeBtn: document.getElementById('combat-flee-btn'),
      combatFinishBtn: document.getElementById('combat-finish-btn'),

      mapModal: document.getElementById('map-modal'),
      mapContent: document.getElementById('map-content'),

      statsModal: document.getElementById('stats-modal'),
      statsContent: document.getElementById('stats-content'),

      inventoryModal: document.getElementById('inventory-modal'),
      inventoryContent: document.getElementById('inventory-content'),
      invCount: document.getElementById('inv-count'),

      journalModal: document.getElementById('journal-modal'),
      journalContent: document.getElementById('journal-content'),

      diceModal: document.getElementById('dice-modal'),
      diceCheckTitle: document.getElementById('dice-check-title'),
      diceDcInfo: document.getElementById('dice-dc-info'),
      diceBox: document.getElementById('dice-box'),
      diceMath: document.getElementById('dice-math'),
      diceResultBanner: document.getElementById('dice-result-banner'),
      diceContinueBtn: document.getElementById('dice-continue-btn')
    };

    this.selectedJournalQuest = 'ALL';
  }

  formatModifier(mod) {
    return mod >= 0 ? `+${mod}` : `${mod}`;
  }

  openCombatModal(combat, playerHealth, handlers = {}) {
    this.updateCombatState(combat, playerHealth, { isFinished: false });
    this.elements.combatModal.classList.remove('hidden');

    this.elements.combatAttackBtn.onclick = () => handlers.onAttack && handlers.onAttack();
    this.elements.combatDodgeBtn.onclick = () => handlers.onDodge && handlers.onDodge();
    this.elements.combatFleeBtn.onclick = () => handlers.onFlee && handlers.onFlee();
    this.elements.combatFinishBtn.onclick = () => {
      this.hideCombatModal();
      if (handlers.onFinish) handlers.onFinish();
    };
  }

  updateCombatState(combat, playerHealth, options = {}) {
    const enemy = combat?.enemy;
    if (!enemy) return;

    const pHp = playerHealth?.hp ?? 0;
    const pMaxHp = playerHealth?.maxHp ?? 50;
    const eHp = Math.max(0, enemy.hp ?? 0);
    const eMaxHp = Math.max(1, enemy.maxHp ?? 1);
    const ePct = Math.max(0, Math.min(100, Math.round((eHp / eMaxHp) * 100)));

    this.elements.combatEnemyName.textContent = enemy.name;
    this.elements.combatEnemyLabel.textContent = enemy.name;
    this.elements.combatTurnLabel.textContent = `Turno ${combat.turn || 1}`;
    this.elements.combatPlayerHpPill.textContent = `HP: ${pHp}/${pMaxHp}`;
    this.elements.combatEnemyHpText.textContent = `${eHp} / ${eMaxHp} HP`;
    this.elements.combatEnemyHpFill.style.width = `${ePct}%`;
    this.elements.combatLogBox.textContent = combat.lastLog || 'Combate em andamento...';

    const isFinished = Boolean(options.isFinished);
    this.elements.combatActions.classList.toggle('hidden', isFinished);
    this.elements.combatFinishBtn.classList.toggle('hidden', !isFinished);
    if (options.finishLabel) {
      this.elements.combatFinishBtn.textContent = options.finishLabel;
    }
  }

  hideCombatModal() {
    this.elements.combatModal.classList.add('hidden');
  }

  renderWorldMap(payload, onTravel = null) {
    const locations = payload?.locations || [];
    const currentLocationId = payload?.currentLocationId || null;
    const state = payload?.state || {};
    const visited = Array.isArray(state?.visitedLocations) ? state.visitedLocations : [];

    if (!locations.length) {
      this.elements.mapContent.innerHTML = '<p>Nenhum local disponível neste mapa.</p>';
      return;
    }

    this.elements.mapContent.innerHTML = locations
      .map((loc) => {
        const isCurrent = loc.id === currentLocationId;
        const isVisited = visited.includes(loc.id);
        const availability = WorldMapSystem.evaluateTravelAvailability(loc, state);

        let statusBadge = isVisited
          ? '<span class="loc-tag visited">Visitado</span>'
          : '<span class="loc-tag unvisited">Inexplorado</span>';

        if (isCurrent) {
          statusBadge = '<span class="loc-tag current">📍 Local Atual</span>';
        }

        const lockNote = !availability.canTravel && availability.reason
          ? `<div class="loc-lock-reason">🔒 ${availability.reason}</div>`
          : '';

        const btnLabel = isCurrent
          ? 'Você está aqui'
          : availability.canTravel
            ? `Viajar para ${loc.name}`
            : 'Bloqueado';

        const disabledAttr = isCurrent || !availability.canTravel ? 'disabled' : '';

        return `
          <div class="location-card ${isCurrent ? 'is-current' : ''} ${!availability.canTravel ? 'is-locked' : ''}">
            <div class="location-top">
              <div>
                <div class="location-region">${loc.region || 'Tamriel'}</div>
                <h3 class="location-name">${loc.name}</h3>
              </div>
              ${statusBadge}
            </div>
            <p class="location-desc">${loc.description || ''}</p>
            ${lockNote}
            <button class="travel-btn" data-location-id="${loc.id}" ${disabledAttr}>${btnLabel}</button>
          </div>
        `;
      })
      .join('');

    if (onTravel) {
      this.elements.mapContent.querySelectorAll('.travel-btn:not(:disabled)').forEach((btn) => {
        btn.addEventListener('click', () => {
          const locId = btn.getAttribute('data-location-id');
          this.toggle('map', false);
          onTravel(locId);
        });
      });
    }
  }

  renderProgressionHeader(progression) {
    const level = progression?.level ?? 1;
    const xp = progression?.xp ?? 0;
    const xpToNext = progression?.xpToNextLevel ?? 100;
    const pending = progression?.pendingStatPoints ?? 0;
    const pct = Math.max(0, Math.min(100, Math.round((xp / xpToNext) * 100)));

    const pendingBadge = pending > 0
      ? `<div class="pending-points-banner">✨ Pontos para distribuir: <strong>${pending}</strong></div>`
      : '';

    return `
      <div class="progression-card">
        <div class="progression-top">
          <span class="level-pill">Nível ${level}</span>
          <span class="xp-label">XP: ${xp} / ${xpToNext}</span>
        </div>
        <div class="xp-bar-track">
          <div class="xp-bar-fill" style="width: ${pct}%;"></div>
        </div>
        ${pendingBadge}
      </div>
    `;
  }

  renderStats(payload, onAllocateStat = null) {
    const stats = payload?.stats ?? payload;
    const progression = payload?.progression;

    if (!stats || Object.keys(stats).length === 0) {
      this.elements.statsContent.innerHTML = '<p>Nenhum atributo registrado.</p>';
      return;
    }

    const pendingPoints = progression?.pendingStatPoints ?? 0;
    const headerHtml = progression ? this.renderProgressionHeader(progression) : '';

    const rowsHtml = Object.entries(stats)
      .map(([stat, value]) => {
        const mod = DiceSystem.getModifier(value);
        const modText = this.formatModifier(mod);
        const canAdd = pendingPoints > 0 && value < 100;
        const step = Math.min(5, pendingPoints, 100 - value);

        const actionBtn = pendingPoints > 0
          ? `<button class="stat-add-btn" data-stat="${stat}" ${!canAdd ? 'disabled' : ''}>+${step}</button>`
          : '';

        return `
          <div class="stat-row">
            <span>${stat}</span>
            <div class="stat-value-group">
              <span>${value} <small class="stat-mod">(${modText})</small></span>
              ${actionBtn}
            </div>
          </div>
        `;
      })
      .join('');

    this.elements.statsContent.innerHTML = `${headerHtml}${rowsHtml}`;

    if (onAllocateStat) {
      this.elements.statsContent.querySelectorAll('.stat-add-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const statName = btn.getAttribute('data-stat');
          onAllocateStat(statName);
        });
      });
    }
  }

  renderInventory(inventory, onUseItem = null) {
    const list = Array.isArray(inventory) ? inventory : [];
    this.elements.invCount.textContent = list.length;

    if (list.length === 0) {
      this.elements.inventoryContent.innerHTML = '<p>A mochila está vazia.</p>';
      return;
    }

    this.elements.inventoryContent.innerHTML = list
      .map((item, idx) => {
        const meta = LootSystem.getItemMetadata(item);
        const isConsumable = meta?.type === 'consumable';
        const desc = meta?.description || 'Item de aventura';
        const useBtn = isConsumable
          ? `<button class="use-item-btn" data-item-index="${idx}">Usar</button>`
          : '';

        return `
          <div class="inventory-item">
            <div class="inventory-item-info">
              <span>🎒 ${item}</span>
              <small class="inventory-item-desc">${desc}</small>
            </div>
            ${useBtn}
          </div>
        `;
      })
      .join('');

    if (onUseItem) {
      this.elements.inventoryContent.querySelectorAll('.use-item-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.getAttribute('data-item-index'));
          onUseItem(idx);
        });
      });
    }
  }

  normalizeJournalItems(history) {
    if (!Array.isArray(history)) return [];
    return history.map((entry, idx) => {
      if (typeof entry === 'string') {
        const match = entry.match(/^\[([^\]]+)\]\s*(.*)$/);
        const prefix = match ? match[1] : 'Jornada';
        const msg = match ? match[2] : entry;
        const parts = prefix.split('•').map((p) => p.trim());
        const questTitle = parts.length > 1 ? parts[0] : 'Quest';
        const displayText = parts.length > 1 ? `[${parts.slice(1).join(' • ')}] ${msg}` : entry;
        return { index: idx + 1, questTitle, text: displayText };
      }

      const questTitle = entry?.questTitle || 'Quest';
      const chapterTitle = entry?.chapterTitle || 'Jornada';
      const msg = entry?.message ?? entry?.text ?? '';
      const text = entry?.text || `[${chapterTitle}] ${msg}`;
      return { index: idx + 1, questTitle, text };
    });
  }

  renderJournal(payload) {
    const rawHistory = Array.isArray(payload) ? payload : (payload?.history || []);
    const quests = Array.isArray(payload?.quests) ? payload.quests : [];
    const items = this.normalizeJournalItems(rawHistory);

    if (items.length === 0) {
      this.selectedJournalQuest = 'ALL';
      this.elements.journalContent.innerHTML = '<p>Nenhum registro no diário ainda.</p>';
      return;
    }

    const questOrder = [];
    quests.forEach((q) => {
      if (q?.title && !questOrder.includes(q.title)) {
        questOrder.push(q.title);
      }
    });
    items.forEach((item) => {
      if (!questOrder.includes(item.questTitle)) {
        questOrder.push(item.questTitle);
      }
    });

    if (this.selectedJournalQuest !== 'ALL' && !questOrder.includes(this.selectedJournalQuest)) {
      this.selectedJournalQuest = 'ALL';
    }

    const filterButtonsHtml = [
      `<button class="journal-filter-pill ${this.selectedJournalQuest === 'ALL' ? 'active' : ''}" data-quest="ALL">Todas (${items.length})</button>`,
      ...questOrder.map((qTitle, i) => {
        const count = items.filter((it) => it.questTitle === qTitle).length;
        const isActive = this.selectedJournalQuest === qTitle;
        return `<button class="journal-filter-pill ${isActive ? 'active' : ''}" data-quest="${encodeURIComponent(qTitle)}">Quest ${i + 1} (${count})</button>`;
      })
    ].join('');

    const visibleQuests = this.selectedJournalQuest === 'ALL'
      ? questOrder
      : questOrder.filter((qTitle) => qTitle === this.selectedJournalQuest);

    const groupsHtml = visibleQuests
      .map((qTitle) => {
        const qItems = items.filter((it) => it.questTitle === qTitle);
        if (!qItems.length) return '';

        const entriesHtml = qItems
          .map((it) => `<div class="journal-entry"><strong>#${it.index}</strong><br>${it.text}</div>`)
          .join('');

        return `
          <section class="journal-quest-group">
            <div class="journal-quest-header">
              <h3 class="journal-quest-title">⚔️ ${qTitle}</h3>
              <span class="journal-quest-count">${qItems.length} ${qItems.length === 1 ? 'nota' : 'notas'}</span>
            </div>
            <div class="journal-quest-entries">${entriesHtml}</div>
          </section>
        `;
      })
      .join('');

    this.elements.journalContent.innerHTML = `
      <div class="journal-filter-bar">${filterButtonsHtml}</div>
      <div class="journal-groups">${groupsHtml}</div>
    `;

    this.elements.journalContent.querySelectorAll('.journal-filter-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rawVal = btn.getAttribute('data-quest');
        this.selectedJournalQuest = rawVal === 'ALL' ? 'ALL' : decodeURIComponent(rawVal);
        this.renderJournal({ history: rawHistory, quests });
      });
    });
  }

  toggle(modalName, show, data = null, actionCallback = null) {
    if (modalName === 'map') {
      if (show) this.renderWorldMap(data, actionCallback);
      this.elements.mapModal.classList.toggle('hidden', !show);
    } else if (modalName === 'stats') {
      if (show) this.renderStats(data, actionCallback);
      this.elements.statsModal.classList.toggle('hidden', !show);
    } else if (modalName === 'inventory') {
      if (show) this.renderInventory(data, actionCallback);
      this.elements.inventoryModal.classList.toggle('hidden', !show);
    } else if (modalName === 'journal') {
      if (show) this.renderJournal(data);
      this.elements.journalModal.classList.toggle('hidden', !show);
    }
  }

  showDiceCheck(stat, dc, statVal) {
    const label = stat.charAt(0).toUpperCase() + stat.slice(1);
    const mod = this.formatModifier(DiceSystem.getModifier(statVal));

    this.elements.diceCheckTitle.textContent = `Teste de ${label}`;
    this.elements.diceDcInfo.textContent = `Dificuldade (CD): ${dc} | Atributo: ${statVal} (${mod})`;
    this.elements.diceBox.classList.add('dice-rolling');
    this.elements.diceMath.textContent = 'Rolando 1d20...';
    this.elements.diceResultBanner.className = 'dice-result-banner hidden';
    this.elements.diceContinueBtn.classList.add('hidden');
    this.elements.diceModal.classList.remove('hidden');
  }

  updateDiceRoll(value) {
    this.elements.diceBox.textContent = value;
  }

  finalizeDiceCheck(result, onContinue) {
    this.elements.diceBox.classList.remove('dice-rolling');
    this.elements.diceBox.textContent = result.d20;

    let note = '';
    if (result.d20 === 20) note = ' (Acerto Crítico!)';
    if (result.d20 === 1) note = ' (Falha Crítica!)';

    const modText = this.formatModifier(result.modifier);
    this.elements.diceMath.textContent = `Dado (${result.d20}) ${modText} = ${result.total}${note}`;
    this.elements.diceResultBanner.classList.remove('hidden');

    if (result.success) {
      this.elements.diceResultBanner.textContent = 'SUCESSO NA AÇÃO!';
      this.elements.diceResultBanner.className = 'dice-result-banner dice-success';
    } else {
      this.elements.diceResultBanner.textContent = 'FALHA NA AÇÃO!';
      this.elements.diceResultBanner.className = 'dice-result-banner dice-fail';
    }

    this.elements.diceContinueBtn.classList.remove('hidden');
    this.elements.diceContinueBtn.onclick = () => {
      this.hideDiceCheck();
      if (onContinue) onContinue();
    };
  }

  hideDiceCheck() {
    this.elements.diceModal.classList.add('hidden');
    this.elements.diceContinueBtn.onclick = null;
  }
}
