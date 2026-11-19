import { ModalManager } from './modals.js';

export class UIManager {
  constructor() {
    this.modals = new ModalManager();

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

      mapBtn: document.getElementById('map-btn'),
      closeMapBtn: document.getElementById('close-map-btn'),
      statsBtn: document.getElementById('stats-btn'),
      closeStatsBtn: document.getElementById('close-stats-btn'),
      inventoryBtn: document.getElementById('inventory-btn'),
      closeInventoryBtn: document.getElementById('close-inventory-btn'),
      journalBtn: document.getElementById('journal-btn'),
      closeJournalBtn: document.getElementById('close-journal-btn')
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
        <small class="book-chapters-count">${totalChapters} Capítulos</small>
      `;
      card.addEventListener('click', () => onSelectBook(book));
      this.elements.booksList.appendChild(card);
    });
  }

  renderHeader(bookTitle, chapterTitle, location = null) {
    this.elements.title.textContent = bookTitle;
    const locSuffix = location ? ` • 📍 ${location.name}` : '';
    this.elements.chapterTitle.textContent = `${chapterTitle}${locSuffix}`;
  }

  renderStatsButtonBadge(progression) {
    const level = progression?.level ?? 1;
    const pending = progression?.pendingStatPoints ?? 0;
    const alertSuffix = pending > 0 ? ` ✨+${pending}` : '';
    this.elements.statsBtn.innerHTML = `📊 Atributos <span class="badge-count">Nv.${level}${alertSuffix}</span>`;
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
        const chance = engine.getSuccessChance(option.diceRoll.stat, option.diceRoll.dc);
        const statName = option.diceRoll.stat.toUpperCase();
        label += ` [🎲 ${statName} | Chance: ${chance}%]`;
      }

      const xpReward = option.gainXp ?? option.xp ?? 0;
      if (xpReward > 0) {
        label += ` [+${xpReward} XP]`;
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

  setAudioButtonText(enabled) {
    this.elements.audioToggleBtn.textContent = enabled ? '🔊 Som: Ligado' : '🔇 Som: Desligado';
  }
}