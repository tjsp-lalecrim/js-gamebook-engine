import { DiceSystem } from './dice.js';

export class CombatSystem {
  static calculateMaxHp(stats = {}, level = 1) {
    const resistencia = stats?.resistencia ?? 50;
    const baseHp = 50;
    const enduranceBonus = Math.round((resistencia - 50) * 0.8);
    const levelBonus = Math.max(0, (level - 1) * 10);
    return Math.max(20, baseHp + enduranceBonus + levelBonus);
  }

  static createInitialHealth(stats = {}, level = 1) {
    const maxHp = this.calculateMaxHp(stats, level);
    return {
      hp: maxHp,
      maxHp
    };
  }

  static syncMaxHp(health, stats = {}, level = 1) {
    const currentHp = health?.hp ?? this.calculateMaxHp(stats, level);
    const previousMax = health?.maxHp ?? currentHp;
    const nextMax = this.calculateMaxHp(stats, level);
    const diff = Math.max(0, nextMax - previousMax);

    return {
      maxHp: nextMax,
      hp: Math.max(0, Math.min(nextMax, currentHp + diff))
    };
  }

  static modifyHp(health, delta, stats = {}, level = 1) {
    const synced = this.syncMaxHp(health, stats, level);
    const numericDelta = Number(delta) || 0;
    const nextHp = Math.max(0, Math.min(synced.maxHp, synced.hp + numericDelta));
    return {
      hp: nextHp,
      maxHp: synced.maxHp,
      actualChange: nextHp - synced.hp,
      isDead: nextHp <= 0
    };
  }

  static healFull(health, stats = {}, level = 1) {
    const maxHp = this.calculateMaxHp(stats, level);
    return {
      hp: maxHp,
      maxHp
    };
  }

  static createEnemyState(enemyConfig = {}) {
    const maxHp = Math.max(1, Number(enemyConfig.hp ?? enemyConfig.maxHp ?? 30));
    return {
      id: enemyConfig.id || enemyConfig.name || 'inimigo',
      name: enemyConfig.name || 'Adversário de Tamriel',
      title: enemyConfig.title || 'Inimigo',
      hp: maxHp,
      maxHp,
      attackStat: enemyConfig.attackStat || 'forca',
      attackBonus: Number(enemyConfig.attackBonus ?? 2),
      dc: Number(enemyConfig.dc ?? 11),
      damageMin: Math.max(1, Number(enemyConfig.damageMin ?? 5)),
      damageMax: Math.max(
        Math.max(1, Number(enemyConfig.damageMin ?? 5)),
        Number(enemyConfig.damageMax ?? 10)
      ),
      xpReward: Math.max(0, Number(enemyConfig.xpReward ?? 40)),
      defeatBlock: enemyConfig.defeatBlock || null,
      fleeBlock: enemyConfig.fleeBlock || null,
      defeatText: enemyConfig.defeatText || 'Você derrotou o inimigo!'
    };
  }

  static rollDamage(minDmg, maxDmg, bonus = 0, isCritical = false) {
    const min = Math.max(1, Number(minDmg) || 1);
    const max = Math.max(min, Number(maxDmg) || min);
    const baseRoll = Math.floor(Math.random() * (max - min + 1)) + min;
    const totalBeforeBonus = isCritical ? baseRoll * 2 : baseRoll;
    return Math.max(1, totalBeforeBonus + (Number(bonus) || 0));
  }

  static resolveEnemyAttack(enemy, playerStats = {}) {
    const d20 = Math.floor(Math.random() * 20) + 1;
    const bonus = Number(enemy.attackBonus ?? 0);
    const total = d20 + bonus;

    // Defesa base do jogador escala levemente com agilidade e resistência
    const agilidadeMod = DiceSystem.getModifier(playerStats?.agilidade ?? 50);
    const resistenciaMod = DiceSystem.getModifier(playerStats?.resistencia ?? 50);
    const playerDefense = 10 + agilidadeMod + Math.floor(resistenciaMod / 2);

    const isCrit = d20 === 20;
    const isFumble = d20 === 1;
    const hit = !isFumble && (isCrit || total >= playerDefense);

    const damage = hit
      ? this.rollDamage(enemy.damageMin, enemy.damageMax, bonus, isCrit)
      : 0;

    return {
      d20,
      bonus,
      total,
      playerDefense,
      hit,
      isCrit,
      isFumble,
      damage
    };
  }

  static resolvePlayerAttack(playerStats = {}, enemy, attackStat = 'forca') {
    const statVal = playerStats?.[attackStat] ?? 50;
    const mod = DiceSystem.getModifier(statVal);
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + mod;
    const targetDc = Number(enemy?.dc ?? 11);

    const isCrit = d20 === 20;
    const isFumble = d20 === 1;
    const hit = !isFumble && (isCrit || total >= targetDc);

    const damage = hit
      ? this.rollDamage(6, 12, mod, isCrit)
      : 0;

    return {
      stat: attackStat,
      statVal,
      modifier: mod,
      d20,
      total,
      dc: targetDc,
      hit,
      isCrit,
      isFumble,
      damage
    };
  }

  static resolveDodgeAttempt(playerStats = {}, enemy) {
    const agilidadeVal = playerStats?.agilidade ?? 50;
    const check = DiceSystem.rollCheck(agilidadeVal, enemy?.dc ?? 11);

    let counterDamage = 0;
    if (check.success && check.d20 === 20) {
      const mod = DiceSystem.getModifier(agilidadeVal);
      counterDamage = this.rollDamage(4, 8, mod, false);
    }

    return {
      ...check,
      counterDamage
    };
  }

  static resolveFleeAttempt(playerStats = {}, enemy) {
    const speedVal = playerStats?.velocidade ?? playerStats?.agilidade ?? 50;
    const dc = Math.max(8, (enemy?.dc ?? 11) - 1);
    return DiceSystem.rollCheck(speedVal, dc);
  }
}