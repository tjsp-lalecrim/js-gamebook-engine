export class UIManager {
  constructor() {
    this.elements = {
      libraryScreen: document.getElementById('library-screen'),
      gameScreen: document.getElementById('game-screen'),
      booksList: document.getElementById('books-list'),
      title: document.getElementById('book-title'),
      chapterTitle: document.getElementById('chapter-title'),
      chapterNav: document.getElementById('chapter-nav'),
      image: document.getElementById('story-image'),
      text: document.getElementById('story-text'),
      options: document.getElementById('options-container'),
      resetBtn: document.getElementById('reset-btn'),
      backBtn: document.getElementById('back-btn'),
      audioToggleBtn: document.getElementById('audio-toggle-btn'),
      
      // Botões e Modais de Menus Rápidos
      statsBtn: document.getElementById('stats-btn'),
      statsModal: document.getElementById('stats-modal'),
      closeStatsBtn: document.getElementById('close-stats-btn'),
      statsContent: document.getElementById('stats-content'),

      inventoryBtn: document.getElementById('inventory-btn'),
      inventoryModal: document.getElementById('inventory-modal'),
      closeInventoryBtn: document.getElementById('close-inventory-btn'),
      inventoryContent: document.getElementById('inventory-content'),
      invCount: document.getElementById('inv-count'),

      journalBtn: document.getElementById('journal-btn'),
      journalModal: document.getElementById('journal-modal'),
      closeJournalBtn: document.getElementById('close-journal-btn'),
      journalContent: document.getElementById('journal-content'),
      
      diceModal: document.getElementById('dice-modal'),
      diceCheckTitle: document.getElementById('dice-check-title'),
      diceDcInfo: document.getElementById('dice-dc-info'),
      diceBox: document.getElementById('dice-box'),
      diceMath: document.getElementById('dice-math'),
      diceResultBanner: document.getElementById('dice-result-banner'),
      diceContinueBtn: document.getElementById('dice-continue-btn')
    };

    this.typingTimeout = null;
    this.currentFullText = '';
    this.isTyping = false;
  }

  showLibrary() {
    this.elements.gameScreen.classList.add('hidden');
    this.elements.libraryScreen.classList.remove('hidden');
  }

  showGame() {
    this.elements.libraryScreen.classList.add('hidden');
    this.elements.gameScreen.classList.remove('hidden');
  }

  renderLibraryList(books, onSelectBook) {
    this.elements.booksList.innerHTML = '';
    books.forEach(book => {
      const totalChapters = book.chapters ? book.chapters.length : 1;
      const card = document.createElement('div');
      card.className = 'book-card';
      card.innerHTML = `
        <h2>${book.title}</h2>
        <p>${book.description || ''}</p>
        <small style="color: #d4a359; display: block; margin-top: 0.5rem;">${totalChapters} Capítulos</small>
      `;
      card.addEventListener('click', () => onSelectBook(book));
      this.elements.booksList.appendChild(card);
    });
  }

  renderHeader(bookTitle, chapterTitle) {
    this.elements.title.textContent = bookTitle;
    this.elements.chapterTitle.textContent = chapterTitle;
  }

  renderChapterNav(chapters, currentIndex, unlockedIndex, onSelectChapter) {
    this.elements.chapterNav.innerHTML = '';
    chapters.forEach((chap, idx) => {
      const pill = document.createElement('button');
      pill.className = `chapter-pill ${idx === currentIndex ? 'active' : ''}`;
      const isLocked = idx > unlockedIndex;
      pill.disabled = isLocked;
      pill.textContent = isLocked ? `🔒 Cap. ${idx + 1}` : `Cap. ${idx + 1}`;
      pill.title = chap.title;

      if (!isLocked) {
        pill.addEventListener('click', () => {
          if (idx !== currentIndex) onSelectChapter(idx);
        });
      }
      this.elements.chapterNav.appendChild(pill);
    });
  }

  renderStatsModal(stats) {
    if (!stats || Object.keys(stats).length === 0) {
      this.elements.statsContent.innerHTML = '<p>Nenhum atributo registrado.</p>';
      return;
    }
    this.elements.statsContent.innerHTML = Object.keys(stats)
      .map(stat => `<div class="stat-row"><span>${stat}</span><span>${stats[stat]}</span></div>`)
      .join('');
  }

  renderInventoryModal(inventory) {
    this.elements.invCount.textContent = inventory.length;
    if (!inventory || inventory.length === 0) {
      this.elements.inventoryContent.innerHTML = '<p>A mochila está vazia.</p>';
      return;
    }
    this.elements.inventoryContent.innerHTML = inventory
      .map(item => `<div class="inventory-item">🎒 ${item}</div>`)
      .join('');
  }

  renderBlockContent(block, onCompleteTyping) {
    if (block.image) {
      this.elements.image.src = block.image;
      this.elements.image.style.display = 'block';
    } else {
      this.elements.image.style.display = 'none';
    }

    this.elements.options.innerHTML = '';
    this.currentFullText = block.content;
    this.startTypewriter(this.currentFullText, onCompleteTyping);
  }

  startTypewriter(text, callback) {
    if (this.typingTimeout) clearTimeout(this.typingTimeout);

    this.elements.text.textContent = '';
    let index = 0;
    this.isTyping = true;
    const speed = 18;

    const type = () => {
      if (index < text.length) {
        this.elements.text.textContent += text.charAt(index);
        index++;
        this.typingTimeout = setTimeout(type, speed);
      } else {
        this.isTyping = false;
        if (callback) callback();
      }
    };
    type();
  }

  skipTypewriter() {
    if (this.isTyping) {
      clearTimeout(this.typingTimeout);
      this.elements.text.textContent = this.currentFullText;
      this.isTyping = false;
      return true;
    }
    return false;
  }

  renderOptions(options, inventory, engine, onSelectOption, onRestart) {
    this.elements.options.innerHTML = '';

    if (!options || options.length === 0) {
      this.createOptionButton('Jogar Novamente desde o Início', onRestart, false);
      return;
    }

    options.forEach(option => {
      const hasItem = !option.requiredItem || inventory.includes(option.requiredItem);
      let label = option.text;

      if (option.requiredItem && !hasItem) {
        label += ` [Requer: ${option.requiredItem}]`;
      } else if (option.diceRoll) {
        const statVal = engine.state.stats[option.diceRoll.stat] || 50;
        const chance = engine.calculateSuccessChance(statVal, option.diceRoll.dc);
        const statName = option.diceRoll.stat.toUpperCase();
        label += ` [🎲 ${statName} | Chance: ${chance}%]`;
      }

      this.createOptionButton(label, () => onSelectOption(option), !hasItem);
    });
  }

  createOptionButton(label, onClick, isDisabled) {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = label;
    btn.disabled = isDisabled;
    if (!isDisabled) {
      btn.addEventListener('click', onClick);
    }
    this.elements.options.appendChild(btn);
  }

  showDiceModal(stat, dc, statVal) {
    this.elements.diceCheckTitle.textContent = `Teste de ${stat.charAt(0).toUpperCase() + stat.slice(1)}`;
    this.elements.diceDcInfo.textContent = `Dificuldade (CD): ${dc} | Atributo: ${statVal}`;
    this.elements.diceBox.classList.add('dice-rolling');
    this.elements.diceMath.textContent = 'Rolando 1d20...';
    this.elements.diceResultBanner.className = 'dice-result-banner hidden';
    this.elements.diceContinueBtn.classList.add('hidden');
    this.elements.diceModal.classList.remove('hidden');
  }

  updateDiceAnimation(fakeRoll) {
    this.elements.diceBox.textContent = fakeRoll;
  }

  finalizeDiceAnimation(result, stat) {
    this.elements.diceBox.classList.remove('dice-rolling');
    this.elements.diceBox.textContent = result.d20;

    let note = '';
    if (result.d20 === 20) note = ' (Acerto Crítico!)';
    if (result.d20 === 1) note = ' (Falha Crítica!)';

    this.elements.diceMath.textContent = `Dado (${result.d20}) + Modif = ${result.total}${note}`;
    this.elements.diceResultBanner.classList.remove('hidden');

    if (result.success) {
      this.elements.diceResultBanner.textContent = 'SUCESSO NA AÇÃO!';
      this.elements.diceResultBanner.className = 'dice-result-banner dice-success';
    } else {
      this.elements.diceResultBanner.textContent = 'FALHA NA AÇÃO!';
      this.elements.diceResultBanner.className = 'dice-result-banner dice-fail';
    }
    this.elements.diceContinueBtn.classList.remove('hidden');
  }

  hideDiceModal() {
    this.elements.diceModal.classList.add('hidden');
  }

  toggleModal(modalName, show, data = []) {
    if (modalName === 'stats') {
      if (show) {
        this.renderStatsModal(data);
        this.elements.statsModal.classList.remove('hidden');
      } else {
        this.elements.statsModal.classList.add('hidden');
      }
    } else if (modalName === 'inventory') {
      if (show) {
        this.renderInventoryModal(data);
        this.elements.inventoryModal.classList.remove('hidden');
      } else {
        this.elements.inventoryModal.classList.add('hidden');
      }
    } else if (modalName === 'journal') {
      if (show) {
        if (data.length === 0) {
          this.elements.journalContent.innerHTML = '<p>Nenhum registro no diário ainda.</p>';
        } else {
          this.elements.journalContent.innerHTML = data
            .map((text, idx) => `<div class="journal-entry"><strong>#${idx + 1}</strong><br>${text}</div>`)
            .join('');
        }
        this.elements.journalModal.classList.remove('hidden');
      } else {
        this.elements.journalModal.classList.add('hidden');
      }
    }
  }

  setAudioButtonText(enabled) {
    this.elements.audioToggleBtn.textContent = enabled ? '🔊 Som: Ligado' : '🔇 Som: Desligado';
  }
}