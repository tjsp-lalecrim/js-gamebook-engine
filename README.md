# 🛡️ Tamriel Gamebook: Arena

> A modular JavaScript text-based RPG engine bringing the classic *The Elder Scrolls: Arena* prologue and campaign to life in an interactive gamebook format.

![JavaScript](https://img.shields.io/badge/JavaScript-ES6%20Modules-yellow)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 📖 About the Project

**Tamriel Gamebook** is a lightweight, zero-dependency interactive fiction engine built entirely with vanilla JavaScript, HTML5, and CSS3. It simulates classic tabletop RPG mechanics—complete with stat sheets, d20 dice rolls, inventory management, and modular chapter navigation—all driven by structured JSON data files.

---

## ✨ Features

- **Modular Architecture:** Clean separation of concerns with ES6 Modules (`engine.js`, `ui.js`, `audio.js`, and `app.js`).
- **Tabletop RPG Mechanics:** Dynamic attribute checks (`Strength`, `Agility`, `Intelligence`, etc.) paired with animated `1d20` dice rolls and success probability calculation.
- **Chapter Progression:** Non-linear storytelling divided into chapters with secure local storage saving.
- **Immersive UI Modals:** Clean, distraction-free pop-up modals for Character Stats, Inventory (Mochila), and Adventure Journal (Diário).
- **Web Audio API Soundscape:** Procedurally generated sound effects (clicks, dice rolls, success/fail chimes) without external audio assets.
- **Data-Driven Stories:** Easily write new campaigns or chapters by modifying plain JSON files (`books.json` and `Stats.json`).

---

## 📁 Project Structure

```text
tamriel-gamebook/
├── index.html          # Main application shell
├── css/
│   └── style.css       # Custom dark fantasy styling & animations
├── data/
│   ├── books.json      # Chapters, story blocks, and branch choices
│   └── Stats.json      # Default character attributes
└── js/
    ├── app.js          # Main application orchestrator
    ├── engine.js       # Game state, save system & dice logic
    ├── ui.js           # DOM rendering, typewriter effect & modals
    └── audio.js        # Web Audio API sound synthesizer