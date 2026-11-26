# 🛡️ Tamriel Gamebook: Arena

> A modular JavaScript text-based RPG engine bringing the classic *The Elder Scrolls: Arena* prologue and campaign to life in an interactive gamebook format.

![JavaScript](https://img.shields.io/badge/JavaScript-ES6%20Modules-yellow)

---

## 📖 About the Project

**Tamriel Gamebook** is a lightweight, zero-dependency interactive fiction engine built entirely with vanilla JavaScript, HTML5, and CSS3. It simulates classic tabletop RPG mechanics—complete with stat sheets, d20 dice rolls, inventory management, and modular chapter navigation—all driven by structured JSON data files.

---

## ✨ Features

- **Modular Architecture:** Clean separation of concerns with ES6 Modules (`engine.js`, `ui.js`, `audio.js`, and `app.js`).
- **Tabletop RPG Mechanics:** Dynamic attribute checks (`Strength`, `Agility`, `Intelligence`, etc.) paired with animated `1d20` dice rolls and success probability calculation.
- **Chapter Progression:** Non-linear storytelling with chapters unlocked per quest and progress saved in browser-local storage.
- **Immersive UI Modals:** Clean, distraction-free pop-up modals for Character Stats, Inventory (Mochila), and Adventure Journal (Diário).
- **Web Audio API Soundscape:** Procedurally generated sound effects (clicks, dice rolls, success/fail chimes) without external audio assets.
- **Data-Driven Stories:** Write campaigns in `Books.json`, define default attributes in `Stats.json`, and configure item effects in `Items.json`.

---

## 📁 Project Structure

```text
js-gamebook-engine/
├── index.html          # Main application shell
├── css/
│   └── style.css       # Custom dark fantasy styling & animations
├── data/
│   ├── Books.json      # Campaigns, chapters, locations, and choices
│   ├── Items.json      # Item catalog
│   └── Stats.json      # Default character attributes
├── js/                 # Game state, UI, and game rules
└── scripts/
    └── check-game.js   # Campaign reference checks and engine regressions
```

## Run locally

From the repository root, start an HTTP server with Python 3:

```sh
python -m http.server 8000
```

Open [the game](http://localhost:8000/) in your browser. To validate the campaign and run the engine checks, use `npm test` with Node.js 16.20 or newer. There are no packages to install.

## Write a campaign

Add an entry like the following to the array in `data/Books.json`.

```json
{
  "id": "forest-path",
  "title": "A trilha da floresta",
  "quests": [{
    "id": "find-the-cabin",
    "title": "Encontre a cabana",
    "chapters": [{
      "id": "forest",
      "title": "Floresta",
      "startBlock": "trail",
      "blocks": {
        "trail": {
          "content": "Uma trilha segue pela floresta até uma cabana.",
          "options": [{ "text": "Seguir a trilha", "nextBlock": "cabin" }]
        },
        "cabin": {
          "content": "Você encontra abrigo para a noite.",
          "giveXp": 20,
          "options": []
        }
      }
    }]
  }]
}
```

Choice destinations can include `nextQuest` and `nextChapter`. Enemies can use `fleeChapter` to retreat to another chapter of the current quest. Quest and chapter indices start at zero.

Blocks grant XP, loot, and attribute changes on the first visit. Set `repeatRewards` to `true` for a block that should grant those effects on each visit. Block healing and damage apply on each entry. For choices with a dice check, success applies the choice effects and failure can apply `failDamage`.
