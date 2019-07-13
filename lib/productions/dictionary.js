import { Container } from "./container.js";
import { Field } from "./field.js";

export class Dictionary extends Container {
  /**
   * @param {import("../tokeniser").Tokeniser} tokeniser
   */
  static parse(tokeniser, { partial } = {}) {
    const tokens = { partial };
    tokens.base = tokeniser.consume("dictionary");
    if (!tokens.base) {
      return;
    }
    return Container.parse(tokeniser, new Dictionary({ source: tokeniser.source, tokens }), {
      type: "dictionary",
      inheritable: !partial,
      allowedMembers: [
        [Field.parse],
      ]
    });
  }

  get type() {
    return "dictionary";
  }
}
