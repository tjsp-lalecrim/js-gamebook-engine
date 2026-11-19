export class DiceSystem {
  /**
   * Calcula o modificador do atributo na escala 0-100 (Base 50 = +0).
   * A cada 5 pontos acima ou abaixo de 50, altera +1 ou -1 no d20.
   */
  static getModifier(statValue = 50) {
    return Math.floor((statValue - 50) / 5);
  }

  /**
   * Calcula a chance real percentual de passar em um teste de 1d20 + modificador >= CD.
   * Considera 20 natural sempre sucesso (mín. 5%) e 1 natural sempre falha (máx. 95%).
   */
  static calculateSuccessChance(statValue, dc) {
    const modifier = this.getModifier(statValue);
    const neededRoll = dc - modifier;

    // Lados do d20 que resultam em sucesso (entre 2 e 20)
    const minSuccessFace = Math.max(2, Math.min(20, neededRoll));
    const winningFaces = neededRoll > 20 ? 1 : (21 - minSuccessFace);

    const chance = (winningFaces / 20) * 100;
    return Math.max(5, Math.min(95, Math.round(chance)));
  }

  /**
   * Executa a rolagem de 1d20 aplicando o modificador do atributo.
   */
  static rollCheck(statValue, dc) {
    const modifier = this.getModifier(statValue);
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + modifier;

    let isSuccess = total >= dc;
    if (d20 === 20) isSuccess = true;
    if (d20 === 1) isSuccess = false;

    return {
      d20,
      statValue,
      modifier,
      total,
      dc,
      success: isSuccess
    };
  }
}