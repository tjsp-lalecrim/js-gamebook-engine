import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { GameEngine } from '../js/engine.js';
import { WorldMapSystem } from '../js/world.js';

const readData = async (file) => JSON.parse(await readFile(new URL(`../data/${file}`, import.meta.url), 'utf8'));
const [books, catalog, { defaultStats }] = await Promise.all([
  readData('Books.json'), readData('Items.json'), readData('Stats.json')
]);
const itemNames = new Set(catalog.items.map(item => item.name));
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const engine = new GameEngine();
const dataFiles = await readdir(new URL('../data/', import.meta.url));
globalThis.fetch = async (path) => {
  const name = path.slice('./data/'.length);
  const ok = path.startsWith('./data/') && dataFiles.includes(name);
  return { ok, json: () => readData(name) };
};
assert.deepEqual((await engine.loadGameData()).books, books);

function checkItems(source, path) {
  const loot = (source.lootTable || source.loot || []).map(entry =>
    typeof entry === 'string' ? entry : entry.item || entry.name
  );
  for (const item of [source.giveItem, source.lootItem, source.requiredItem, ...loot]) {
    if (item !== undefined) check(itemNames.has(item), `${path}: item desconhecido ${item}`);
  }
}

for (const book of books) {
  const quests = engine.getBookQuests(book);
  const locations = WorldMapSystem.getBookLocations(book);
  const locationIds = new Set(locations.map(location => location.id));
  const checkBlock = (questIndex, chapterIndex, blockId, path) => {
    const chapter = quests[questIndex]?.chapters?.[chapterIndex];
    const target = blockId ?? chapter?.startBlock;
    check(Boolean(chapter?.blocks && Object.hasOwn(chapter.blocks, target)),
      `${book.id}/${path}: destino inválido (${questIndex}, ${chapterIndex}, ${target})`);
  };

  for (const location of locations) {
    const qIdx = location.questIndex ?? 0;
    checkBlock(qIdx, location.chapterIndex ?? quests[qIdx]?.startChapter ?? 0, location.blockId, location.id);
    checkItems(location, location.id);
  }
  for (const [qIdx, quest] of quests.entries()) {
    checkBlock(qIdx, quest.startChapter ?? 0, null, quest.id);
    for (const [cIdx, chapter] of quest.chapters.entries()) {
      checkBlock(qIdx, cIdx, chapter.startBlock, chapter.id);
      for (const [blockId, block] of Object.entries(chapter.blocks)) {
        const path = `${chapter.id}/${blockId}`;
        for (const source of [block, ...(block.options || [])]) {
          checkItems(source, path);
          if (source.nextBlock != null || source.nextChapter != null || source.nextQuest != null) {
            const qTarget = source.nextQuest ?? qIdx;
            const cTarget = source.nextChapter ?? (source.nextQuest == null ? cIdx : quests[qTarget]?.startChapter ?? 0);
            checkBlock(qTarget, cTarget, source.nextBlock, path);
          }
          if (source.failBlock != null) checkBlock(qIdx, cIdx, source.failBlock, path);
          if (source.travelToLocation != null) check(locationIds.has(source.travelToLocation), `${path}: local desconhecido`);
          if (source.diceRoll) {
            check(Object.hasOwn(book.initialStats || {}, source.diceRoll.stat) || Object.hasOwn(defaultStats, source.diceRoll.stat),
              `${path}: atributo de teste desconhecido`);
          }
          if (source.enemy) {
            const { defeatBlock, fleeBlock, fleeChapter } = source.enemy;
            checkItems(source.enemy, path);
            if (defeatBlock != null) checkBlock(qIdx, cIdx, defeatBlock, path);
            if (fleeBlock != null || fleeChapter != null) checkBlock(qIdx, fleeChapter ?? cIdx, fleeBlock, path);
          }
        }
      }
    }
  }
}
assert.deepEqual(errors, []);
console.log('Referências da campanha válidas.');

const saves = new Map();
globalThis.localStorage = {
  getItem: key => saves.get(key),
  setItem: (key, value) => saves.set(key, value)
};
const book = books[0];
engine.openBook(book);

engine.moveToBlock('falha_grade');
const xpAfterFirstVisit = engine.state.progression.xp;
engine.moveToBlock('cela_inicio');
engine.openBook(book);
engine.moveToBlock('falha_grade');
assert.equal(engine.state.progression.xp, xpAfterFirstVisit);

const checkOption = { gainXp: 5, gainStats: { forca: 2 }, failDamage: 3 };
const strength = engine.state.stats.forca;
const health = engine.state.health.hp;
engine.applyOptionEffects(checkOption, false);
assert.equal(engine.state.health.hp, health - 3);
assert.equal(engine.state.stats.forca, strength);
assert.equal(engine.state.progression.xp, xpAfterFirstVisit);
engine.applyOptionEffects(checkOption, true);
assert.equal(engine.state.progression.xp, xpAfterFirstVisit + 5);
assert.equal(engine.state.stats.forca, strength + 2);

engine.moveToBlock('corredor_guarda');
engine.activeCombat.enemy.hp = 1;
engine.activeCombat.turn = 3;
engine.saveProgress();
engine.openBook(book);
assert.equal(engine.activeCombat.enemy.hp, 1);
assert.equal(engine.activeCombat.turn, 3);
engine.activeCombat.enemy.hp = 0;
engine.setCombatOutcome('victory');
engine.openBook(book);
assert.equal(engine.finishCombat(), 'victory');
assert.equal(engine.finishCombat(), null);
assert.equal(engine.state.rewardedCombats.length, 1);
engine.openBook(book);
assert.equal(engine.activeCombat, null);

engine.moveToBlock('corredor_guarda');
engine.activeCombat.enemy.hp = 0;
engine.setCombatOutcome('victory');
engine.finishCombat();
assert.equal(engine.state.rewardedCombats.length, 1);

engine.goToChapter(1);
engine.goToQuest(1);
assert.equal(engine.state.unlockedChapter, 0);
assert.equal(engine.travelToLocation('camara-das-runas'), null);
assert.ok(engine.travelToLocation('esgotos-da-cidade'));
engine.goToQuest(1, 1);
assert.equal(engine.activeCombat.enemy.id, 'sentinela-cristal');
engine.setCombatOutcome('flee');
engine.openBook(book);
assert.equal(engine.finishCombat(), 'flee');
assert.equal(engine.state.chapterIndex, 0);
assert.equal(engine.state.blockId, 'entrada_ruinas');

engine.goToChapter(1);
engine.applyHpChange(-999, '', false);
engine.setCombatOutcome('defeat_player');
engine.openBook(book);
assert.equal(engine.activeCombat.outcome, 'defeat_player');
assert.equal(engine.finishCombat(), 'defeat_player');
assert.equal(engine.state.health.hp, 0);
engine.openBook(book);
assert.equal(engine.activeCombat, null);

engine.restartGame();
engine.moveToBlock('corredor_guarda');
const [saveKey] = saves.keys();
const legacy = JSON.parse(saves.get(saveKey));
delete legacy.activeCombat;
delete legacy.visitedBlocks;
delete legacy.unlockedChapters;
saves.set(saveKey, JSON.stringify(legacy));
engine.openBook(book);
assert.ok(engine.activeCombat);
assert.ok(engine.state.visitedBlocks.includes(JSON.stringify([0, 0, 'corredor_guarda'])));

console.log('Regressões de recompensas, testes de dados, combate e progressão passaram.');
