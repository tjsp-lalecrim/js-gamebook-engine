import { DiceSystem } from './dice.js';

export class ModalManager {
  constructor() {
    this.elements = {
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
  }

  formatModifier(mod) {
    return mod >= 0 ? `+${mod}` : `${mod}`;
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

  renderInventory(inventory) {
    this.elements.invCount.textContent = inventory.length;

    if (!inventory || inventory.length === 0) {
      this.elements.inventoryContent.innerHTML = '<p>A mochila está vazia.</p>';
      return;
    }

    this.elements.inventoryContent.innerHTML = inventory
      .map(item => `<div class="inventory-item">🎒 ${item}</div>`)
      .join('');
  }

  renderJournal(history) {
    if (!history || history.length === 0) {
      this.elements.journalContent.innerHTML = '<p>Nenhum registro no diário ainda.</p>';
      return;
    }

    this.elements.journalContent.innerHTML = history
      .map((text, idx) => `<div class="journal-entry"><strong>#${idx + 1}</strong><br>${text}</div>`)
      .join('');
  }

  toggle(modalName, show, data = null, onAllocateStat = null) {
    if (modalName === 'stats') {
      if (show) this.renderStats(data, onAllocateStat);
      this.elements.statsModal.classList.toggle('hidden', !show);
    } else if (modalName === 'inventory') {
      if (show) this.renderInventory(data);
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
  }
}