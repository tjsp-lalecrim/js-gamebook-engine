export class ProgressionSystem {
  static getXpForNextLevel(level = 1) {
    return Math.max(50, level * 100);
  }

  static createInitialProgression() {
    return {
      level: 1,
      xp: 0,
      xpToNextLevel: this.getXpForNextLevel(1),
      pendingStatPoints: 0
    };
  }

  /**
   * Adiciona XP ao estado da progressão e processa eventuais subidas de nível.
   * Retorna um resumo do que aconteceu para registro no diário/feedback.
   */
  static grantXp(progression, stats, amount) {
    const xpGain = Number(amount) || 0;
    if (xpGain <= 0) {
      return { gained: 0, leveledUpCount: 0, newLevel: progression.level };
    }

    progression.xp += xpGain;
    let leveledUpCount = 0;

    while (progression.xp >= progression.xpToNextLevel) {
      progression.xp -= progression.xpToNextLevel;
      progression.level += 1;
      progression.pendingStatPoints += 5;
      progression.xpToNextLevel = this.getXpForNextLevel(progression.level);
      leveledUpCount += 1;
    }

    // Garante que todos os atributos existentes permaneçam válidos na faixa 0-100
    if (stats) {
      for (const key of Object.keys(stats)) {
        stats[key] = Math.max(0, Math.min(100, stats[key]));
      }
    }

    return {
      gained: xpGain,
      leveledUpCount,
      newLevel: progression.level,
      pointsAwarded: leveledUpCount * 5
    };
  }

  /**
   * Distribui pontos pendentes de nível em um atributo específico (incremento padrão: 5).
   */
  static allocateStatPoint(progression, stats, statName, step = 5) {
    if (!progression || progression.pendingStatPoints <= 0) return false;
    if (!stats || stats[statName] === undefined) return false;
    if (stats[statName] >= 100) return false;

    const applied = Math.min(step, progression.pendingStatPoints, 100 - stats[statName]);
    if (applied <= 0) return false;

    stats[statName] += applied;
    progression.pendingStatPoints -= applied;
    return true;
  }
}